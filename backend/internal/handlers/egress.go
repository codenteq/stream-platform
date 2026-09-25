package handlers

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
	lk_protocol "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"
)

// Aynı yayın için eşzamanlı başlat/durdur isteklerinin çift egress açmasını önler.
var broadcastLocks sync.Map

func lockBroadcast(id uint) func() {
	v, _ := broadcastLocks.LoadOrStore(id, &sync.Mutex{})
	m := v.(*sync.Mutex)
	m.Lock()
	return m.Unlock
}

// egressGone, durdurma hatasının egress'in zaten bulunmadığı/sonlandığı anlamına gelip gelmediğini söyler.
func egressGone(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not_found") || strings.Contains(msg, "not found") ||
		strings.Contains(msg, "failed_precondition") || strings.Contains(msg, "cannot be stopped")
}

// activeEgressIDs, odadaki hâlâ çalışan egress'lerin kimliklerini döner.
func activeEgressIDs(ctx context.Context, client *lksdk.EgressClient, room string) (map[string]bool, error) {
	res, err := client.ListEgress(ctx, &lk_protocol.ListEgressRequest{RoomName: room, Active: true})
	if err != nil {
		return nil, err
	}
	ids := make(map[string]bool, len(res.Items))
	for _, e := range res.Items {
		ids[e.EgressId] = true
	}
	return ids, nil
}

func StartEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")
	input := new(models.TrackEgressInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast models.Broadcast
	if result := database.DB.Preload("Targets").First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to start egress for this broadcast"})
	}

	if len(broadcast.Targets) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No streaming targets configured for this broadcast"})
	}

	unlock := lockBroadcast(broadcast.ID)
	defer unlock()
	// Kilit beklenirken başka bir istek hedefleri değiştirmiş olabilir; güncel hâlini oku.
	database.DB.Where("broadcast_id = ?", broadcast.ID).Find(&broadcast.Targets)

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	// Kayıtlı ama artık çalışmayan egress'leri temizle; yeniden başlatmada hepsini durdur.
	listCtx, cancelList := context.WithTimeout(context.Background(), 10*time.Second)
	active, listErr := activeEgressIDs(listCtx, egressClient, broadcast.StudioCode)
	cancelList()
	for i := range broadcast.Targets {
		t := &broadcast.Targets[i]
		if t.EgressID == "" {
			continue
		}
		if input.Restart {
			stopCtx, cancelStop := context.WithTimeout(context.Background(), 10*time.Second)
			if _, err := egressClient.StopEgress(stopCtx, &lk_protocol.StopEgressRequest{EgressId: t.EgressID}); err != nil && !egressGone(err) {
				log.Printf("Restart: failed to stop egress %s: %v", t.EgressID, err)
			}
			cancelStop()
		} else if listErr != nil || active[t.EgressID] {
			continue // gerçekten yayında (ya da doğrulanamadı): dokunma
		}
		t.EgressID = ""
		database.DB.Model(t).Update("egress_id", "")
	}

	// Determine encoding options based on quality, FPS, and user input
	var width, height int32
	videoBitrate := input.VideoBitrate
	audioBitrate := input.AudioBitrate
	fps := input.FPS
	if fps <= 0 {
		fps = 30
	}

	// Bitrate validation constants
	const (
		MinVideoBitrate = 1000  // 1 Mbps
		MaxVideoBitrate = 20000 // 20 Mbps
		MinAudioBitrate = 64
		MaxAudioBitrate = 320
	)

	// Audio bitrate validasyonu
	if audioBitrate <= 0 {
		audioBitrate = 128
	} else if audioBitrate < MinAudioBitrate {
		audioBitrate = MinAudioBitrate
	} else if audioBitrate > MaxAudioBitrate {
		audioBitrate = MaxAudioBitrate
	}

	// Quality'ye göre boyut ve varsayılan video bitrate
	switch input.Quality {
	case "1080p":
		width, height = 1920, 1080
		if videoBitrate <= 0 {
			videoBitrate = 10000 // Varsayılan: Yüksek
		}
	case "720p":
		width, height = 1280, 720
		if videoBitrate <= 0 {
			videoBitrate = 6000
		}
	case "480p":
		width, height = 854, 480
		if videoBitrate <= 0 {
			videoBitrate = 3000
		}
	default:
		width, height = 854, 480
		if videoBitrate <= 0 {
			videoBitrate = 3000
		}
	}

	// 60fps için bitrate'i %50 artır
	if fps == 60 {
		videoBitrate = int32(float64(videoBitrate) * 1.5)
	}

	// Video bitrate validasyonu (60fps artışından sonra)
	if videoBitrate < MinVideoBitrate {
		videoBitrate = MinVideoBitrate
	} else if videoBitrate > MaxVideoBitrate {
		videoBitrate = MaxVideoBitrate
	}

	log.Printf("Egress başlatılıyor: Quality=%s, FPS=%d, VideoBitrate=%d kbps, AudioBitrate=%d kbps",
		input.Quality, fps, videoBitrate, audioBitrate)

	type targetResult struct {
		ID       uint   `json:"id"`
		Platform string `json:"platform"`
		Name     string `json:"name"`
		Error    string `json:"error,omitempty"`
	}
	started := []targetResult{}
	failed := []targetResult{}

	// Hedefler paralel başlatılır; biri yavaş/erişilemez olsa da diğerleri beklemez.
	var (
		wg sync.WaitGroup
		mu sync.Mutex
	)
	for _, target := range broadcast.Targets {
		if target.EgressID != "" {
			// Bu hedef zaten yayında.
			started = append(started, targetResult{ID: target.ID, Platform: target.Platform, Name: target.Name})
			continue
		}

		wg.Add(1)
		go func(target models.StreamingTarget) {
			defer wg.Done()

			req := &lk_protocol.TrackCompositeEgressRequest{
				RoomName:     broadcast.StudioCode,
				VideoTrackId: input.TrackID,
				AudioTrackId: input.AudioTrackID,
				Options: &lk_protocol.TrackCompositeEgressRequest_Advanced{
					Advanced: &lk_protocol.EncodingOptions{
						Width:            width,
						Height:           height,
						Framerate:        fps,
						VideoBitrate:     videoBitrate,
						VideoCodec:       lk_protocol.VideoCodec_H264_HIGH,
						AudioBitrate:     audioBitrate,
						AudioCodec:       lk_protocol.AudioCodec_AAC,
						AudioFrequency:   44100,
						KeyFrameInterval: 2.0,
					},
				},
				Output: &lk_protocol.TrackCompositeEgressRequest_Stream{
					Stream: &lk_protocol.StreamOutput{
						Protocol: lk_protocol.StreamProtocol_RTMP,
						Urls:     []string{fmt.Sprintf("%s/%s", strings.TrimSuffix(target.RTMPUrl, "/"), target.StreamKey)},
					},
				},
			}

			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()
			egress, err := egressClient.StartTrackCompositeEgress(ctx, req)

			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				log.Printf("Failed to start egress for target %d: %v", target.ID, err)
				failed = append(failed, targetResult{ID: target.ID, Platform: target.Platform, Name: target.Name, Error: err.Error()})
				return
			}
			target.EgressID = egress.EgressId
			database.DB.Model(&target).Update("egress_id", egress.EgressId)
			started = append(started, targetResult{ID: target.ID, Platform: target.Platform, Name: target.Name})
		}(target)
	}
	wg.Wait()

	if len(started) == 0 {
		errMsg := "Failed to start egress for all targets"
		if len(failed) > 0 {
			errMsg = failed[0].Error
		}
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": errMsg, "failed": failed})
	}

	if broadcast.Status != models.BroadcastStatusLive {
		now := time.Now()
		broadcast.Status = models.BroadcastStatusLive
		broadcast.StartedAt = &now
		broadcast.EndedAt = nil
		database.DB.Model(&broadcast).Select("status", "started_at", "ended_at").Updates(&broadcast)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":    "Egress processes started",
		"started":    started,
		"failed":     failed,
		"started_at": broadcast.StartedAt,
	})
}

func StopEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")

	var broadcast models.Broadcast
	if result := database.DB.First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to stop egress for this broadcast"})
	}

	unlock := lockBroadcast(broadcast.ID)
	defer unlock()
	database.DB.Where("broadcast_id = ?", broadcast.ID).Find(&broadcast.Targets)

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	stillRunning := []string{}
	for _, target := range broadcast.Targets {
		if target.EgressID == "" {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		_, err := egressClient.StopEgress(ctx, &lk_protocol.StopEgressRequest{EgressId: target.EgressID})
		cancel()
		if err != nil && !egressGone(err) {
			// Kimliği koru ki durdurma yeniden denenebilsin; yoksa egress yetim kalır.
			log.Printf("Failed to stop egress %s for target %d: %v", target.EgressID, target.ID, err)
			name := target.Name
			if name == "" {
				name = target.Platform
			}
			stillRunning = append(stillRunning, name)
			continue
		}
		database.DB.Model(&target).Update("egress_id", "")
	}

	if len(stillRunning) > 0 {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":         "Some outputs could not be stopped: " + strings.Join(stillRunning, ", "),
			"still_running": stillRunning,
		})
	}

	now := time.Now()
	broadcast.Status = models.BroadcastStatusEnded
	broadcast.EndedAt = &now
	database.DB.Model(&broadcast).Select("status", "ended_at").Updates(&broadcast)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Egress processes stopped"})
}

func createStudioToken(room, identity, name, role string) (string, error) {
	at := auth.NewAccessToken(os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))
	canPub := true
	canSub := true
	canPubData := true
	grant := &auth.VideoGrant{
		RoomJoin:       true,
		Room:           room,
		CanPublish:     &canPub,
		CanSubscribe:   &canSub,
		CanPublishData: &canPubData,
	}
	metadata := fmt.Sprintf(`{"role":%q}`, role)

	at.AddGrant(grant).
		SetIdentity(identity).
		SetName(name).
		SetMetadata(metadata).
		SetValidFor(time.Hour * 12) // Extended for long streams

	return at.ToJWT()
}

func cleanDisplayName(name string) string {
	name = strings.TrimSpace(name)
	if len([]rune(name)) > 40 {
		name = string([]rune(name)[:40])
	}
	return name
}

// CreateLiveKitToken yalnızca yayının sahibine "host" rolüyle token verir.
// Sahibi olmayan giriş yapmış kullanıcılar 403 alır ve misafir akışına yönlendirilir.
func CreateLiveKitToken(c *fiber.Ctx) error {
	input := new(models.LiveKitTokenInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	userId := getUserIdFromToken(c)

	var broadcast models.Broadcast
	if err := database.DB.First(&broadcast, "studio_code = ?", input.Room).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Studio not found"})
	}
	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only the studio owner can join as host"})
	}

	var user models.User
	database.DB.First(&user, userId)

	name := cleanDisplayName(input.Name)
	if name == "" {
		name = user.Name
	}
	if name == "" {
		name = strings.Split(user.Email, "@")[0]
	}

	token, err := createStudioToken(input.Room, fmt.Sprintf("host-%d", userId), name, "host")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create LiveKit token"})
	}

	return c.JSON(fiber.Map{"token": token, "role": "host"})
}

func JoinStudioPublic(c *fiber.Ctx) error {
	input := new(models.JoinStudioInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	name := cleanDisplayName(input.Name)
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name is required"})
	}

	var broadcast models.Broadcast
	if err := database.DB.First(&broadcast, "studio_code = ?", input.StudioCode).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Studio not found"})
	}

	identity := "guest-" + strings.ReplaceAll(uuid.New().String(), "-", "")[:12]
	token, err := createStudioToken(input.StudioCode, identity, name, "guest")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create LiveKit token"})
	}

	return c.JSON(fiber.Map{"token": token, "role": "guest"})
}

func getOwnedBroadcastByStudioCode(c *fiber.Ctx) (*models.Broadcast, error) {
	userId := getUserIdFromToken(c)
	var broadcast models.Broadcast
	if err := database.DB.First(&broadcast, "studio_code = ? AND user_id = ?", c.Params("studioCode"), userId).Error; err != nil {
		return nil, err
	}
	return &broadcast, nil
}

func newRoomClient() *lksdk.RoomServiceClient {
	return lksdk.NewRoomServiceClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))
}

// RemoveParticipant, yapımcının bir misafiri stüdyodan çıkarmasını sağlar.
func RemoveParticipant(c *fiber.Ctx) error {
	broadcast, err := getOwnedBroadcastByStudioCode(c)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}
	input := new(models.ParticipantActionInput)
	if err := c.BodyParser(input); err != nil || input.Identity == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "identity is required"})
	}

	_, err = newRoomClient().RemoveParticipant(context.Background(), &lk_protocol.RoomParticipantIdentity{
		Room:     broadcast.StudioCode,
		Identity: input.Identity,
	})
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// MuteParticipant, yapımcının bir misafirin mikrofonunu kapatmasını sağlar.
func MuteParticipant(c *fiber.Ctx) error {
	broadcast, err := getOwnedBroadcastByStudioCode(c)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}
	input := new(models.ParticipantActionInput)
	if err := c.BodyParser(input); err != nil || input.Identity == "" || input.TrackSid == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "identity and trackSid are required"})
	}

	_, err = newRoomClient().MutePublishedTrack(context.Background(), &lk_protocol.MuteRoomTrackRequest{
		Room:     broadcast.StudioCode,
		Identity: input.Identity,
		TrackSid: input.TrackSid,
		Muted:    true,
	})
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
	lk_protocol "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// --- MODELS ---
type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Email        string `gorm:"unique;not null" json:"email"`
	PasswordHash string `gorm:"not null" json:"-"`
	CreatedAt    time.Time
}

type Broadcast struct {
	ID          uint              `gorm:"primaryKey" json:"id"`
	UserID      uint              `gorm:"not null" json:"user_id"`
	User        User              `gorm:"foreignKey:UserID" json:"user"`
	Title       string            `gorm:"not null" json:"title"`
	StudioCode  string            `gorm:"unique;not null" json:"studio_code"`
	LogoURL     string            `json:"logo_url"`
	ShowLogo    bool              `json:"show_logo"`
	OverlayURL  string            `json:"overlay_url"`
	ShowOverlay bool              `json:"show_overlay"`
	Targets     []StreamingTarget `gorm:"foreignKey:BroadcastID" json:"targets"`
	CreatedAt   time.Time         `json:"created_at"`
}

type StreamingTarget struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	BroadcastID uint   `gorm:"not null" json:"broadcast_id"`
	Platform    string `gorm:"not null" json:"platform"`
	RTMPUrl     string `gorm:"not null" json:"rtmp_url"`
	StreamKey   string `gorm:"not null" json:"stream_key"`
	EgressID    string `json:"egress_id,omitempty"`
	CreatedAt   time.Time
}

// --- DATABASE ---
var DB *gorm.DB

func ConnectDatabase() {
	var err error
	dsn := os.Getenv("DB_SOURCE")
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connection successful.")

	err = DB.AutoMigrate(&User{}, &Broadcast{}, &StreamingTarget{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migration successful.")
}

// --- API INPUTS ---
type AuthInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type BroadcastInput struct {
	Title       string `json:"title"`
	LogoURL     string `json:"logo_url"`
	ShowLogo    bool   `json:"show_logo"`
	OverlayURL  string `json:"overlay_url"`
	ShowOverlay bool   `json:"show_overlay"`
}

type LiveKitTokenInput struct {
	Room string `json:"room"`
}

type TrackEgressInput struct {
	TrackID      string `json:"trackId"`
	AudioTrackID string `json:"audioTrackId"`
	Quality      string `json:"quality"`
	FPS          int32  `json:"fps"`
}

type StreamingTargetInput struct {
	Platform  string `json:"platform"`
	RTMPUrl   string `json:"rtmp_url"`
	StreamKey string `json:"stream_key"`
}

// --- HANDLERS ---
func Register(c *fiber.Ctx) error {
	input := new(AuthInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	user := User{Email: input.Email, PasswordHash: string(hashedPassword)}

	if result := DB.Create(&user); result.Error != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email already exists"})
	}

	return c.Status(fiber.StatusCreated).JSON(user)
}

func Login(c *fiber.Ctx) error {
	input := new(AuthInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var user User
	if result := DB.First(&user, "email = ?", input.Email); result.Error != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create token"})
	}

	return c.JSON(fiber.Map{"token": t})
}

func getUserIdFromToken(c *fiber.Ctx) uint {
	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	userId := uint(claims["user_id"].(float64))
	return userId
}

func GetCurrentUser(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var user User
	if result := DB.First(&user, userId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

func GetBroadcasts(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var broadcasts []Broadcast

	DB.Order("created_at desc").Where("user_id = ?", userId).Preload("Targets").Find(&broadcasts)

	return c.JSON(broadcasts)
}

func GetBroadcastByStudioCode(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")

	var broadcast Broadcast
	if result := DB.Preload("Targets").First(&broadcast, "studio_code = ? AND user_id = ?", studioCode, userId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	return c.JSON(broadcast)
}

func CreateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(BroadcastInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	broadcast := Broadcast{
		Title:      input.Title,
		UserID:     userId,
		StudioCode: uuid.New().String(),
	}

	if result := DB.Create(&broadcast); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create broadcast"})
	}

	return c.Status(fiber.StatusCreated).JSON(broadcast)
}

func UpdateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	input := new(BroadcastInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast Broadcast
	if result := DB.First(&broadcast, broadcastId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to edit this broadcast"})
	}

	broadcast.Title = input.Title
	broadcast.LogoURL = input.LogoURL
	broadcast.ShowLogo = input.ShowLogo
	broadcast.OverlayURL = input.OverlayURL
	broadcast.ShowOverlay = input.ShowOverlay
	DB.Save(&broadcast)

	return c.JSON(broadcast)
}

func DeleteBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")

	var broadcast Broadcast
	if result := DB.First(&broadcast, broadcastId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to delete this broadcast"})
	}
	// Also delete associated targets
	if err := DB.Where("broadcast_id = ?", broadcast.ID).Delete(&StreamingTarget{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete associated targets"})
	}

	if result := DB.Delete(&broadcast); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete broadcast"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Streaming Target Handlers ---

func GetStreamingTargets(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")

	var broadcast Broadcast
	if err := DB.First(&broadcast, "id = ? AND user_id = ?", broadcastId, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found or you are not authorized"})
	}

	var targets []StreamingTarget
	DB.Where("broadcast_id = ?", broadcastId).Find(&targets)

	return c.JSON(targets)
}

func AddStreamingTarget(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	input := new(StreamingTargetInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast Broadcast
	if err := DB.First(&broadcast, "id = ? AND user_id = ?", broadcastId, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found or you are not authorized"})
	}

	target := StreamingTarget{
		BroadcastID: broadcast.ID,
		Platform:    input.Platform,
		RTMPUrl:     input.RTMPUrl,
		StreamKey:   input.StreamKey,
	}

	if result := DB.Create(&target); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create streaming target"})
	}

	return c.Status(fiber.StatusCreated).JSON(target)
}

func DeleteStreamingTarget(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	targetId := c.Params("targetId")

	var broadcast Broadcast
	if err := DB.First(&broadcast, "id = ? AND user_id = ?", broadcastId, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found or you are not authorized"})
	}

	var target StreamingTarget
	if err := DB.First(&target, "id = ? AND broadcast_id = ?", targetId, broadcast.ID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Target not found"})
	}

	if result := DB.Delete(&target); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete streaming target"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Egress Handlers ---

func StartEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")
	input := new(TrackEgressInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast Broadcast
	if result := DB.Preload("Targets").First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to start egress for this broadcast"})
	}

	if len(broadcast.Targets) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No streaming targets configured for this broadcast"})
	}

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	// Determine encoding options based on quality and FPS
	var width, height, videoBitrate int32
	fps := input.FPS
	if fps <= 0 {
		fps = 30
	}

	switch input.Quality {
	case "1080p":
		width, height, videoBitrate = 1920, 1080, 6000
	case "720p":
		width, height, videoBitrate = 1280, 720, 3000
	case "480p":
		width, height, videoBitrate = 854, 480, 1500
	default:
		// Default to 480p for stability
		width, height, videoBitrate = 854, 480, 1500
	}

	// Increase bitrate for 60fps
	if fps == 60 {
		videoBitrate = int32(float64(videoBitrate) * 1.5)
	}

	for _, target := range broadcast.Targets {
		rtmpUrl := target.RTMPUrl

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
					AudioBitrate:     128,
					AudioCodec:       lk_protocol.AudioCodec_AAC,
					AudioFrequency:   44100,
					KeyFrameInterval: 2.0,
				},
			},
			Output: &lk_protocol.TrackCompositeEgressRequest_Stream{
				Stream: &lk_protocol.StreamOutput{
					Protocol: lk_protocol.StreamProtocol_RTMP,
					Urls:     []string{fmt.Sprintf("%s/%s", strings.TrimSuffix(rtmpUrl, "/"), target.StreamKey)},
				},
			},
		}

		egress, err := egressClient.StartTrackCompositeEgress(context.Background(), req)
		if err != nil {
			log.Printf("Failed to start egress for target %d: %v", target.ID, err)
			// Continue to next target, maybe collect errors and return them
			continue
		}

		target.EgressID = egress.EgressId
		DB.Save(&target)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Egress processes started"})
}

func StopEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")

	var broadcast Broadcast
	if result := DB.Preload("Targets").First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to stop egress for this broadcast"})
	}

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	for _, target := range broadcast.Targets {
		if target.EgressID != "" {
			_, err := egressClient.StopEgress(context.Background(), &lk_protocol.StopEgressRequest{
				EgressId: target.EgressID,
			})
			if err != nil {
				log.Printf("Failed to stop egress %s for target %d: %v", target.EgressID, target.ID, err)
				// Continue to next target
				continue
			}
			target.EgressID = ""
			DB.Save(&target)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Egress processes stopped"})
}

func CreateLiveKitToken(c *fiber.Ctx) error {
	input := new(LiveKitTokenInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	participantIdentity := claims["email"].(string)

	at := auth.NewAccessToken(os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))
	canPub := true
	canSub := true
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         input.Room,
		CanPublish:   &canPub,
		CanSubscribe: &canSub,
	}
	// Set role as host in metadata for authenticated users
	metadata := `{"role":"host"}`

	at.AddGrant(grant).
		SetIdentity(participantIdentity).
		SetMetadata(metadata).
		SetValidFor(time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create LiveKit token"})
	}

	return c.JSON(fiber.Map{"token": token})
}

type JoinStudioInput struct {
	StudioCode string `json:"studioCode"`
	Name       string `json:"name"`
}

func JoinStudioPublic(c *fiber.Ctx) error {
	input := new(JoinStudioInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	at := auth.NewAccessToken(os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))
	canPub := true
	canSub := true
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         input.StudioCode,
		CanPublish:   &canPub,
		CanSubscribe: &canSub,
	}
	// Set role as guest in metadata
	metadata := `{"role":"guest"}`

	at.AddGrant(grant).
		SetIdentity(input.Name).
		SetName(input.Name).
		SetMetadata(metadata).
		SetValidFor(time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create LiveKit token"})
	}

	return c.JSON(fiber.Map{"token": token})
}

// --- MAIN ---
func main() {
	ConnectDatabase()

	app := fiber.New()

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello from Go Backend! Broadcast management is ready.")
	})

	api := app.Group("/api")
	api.Post("/register", Register)
	api.Post("/login", Login)
	api.Post("/public/join-studio", JoinStudioPublic)

	// Protected routes
	protected := api.Group("/", jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(os.Getenv("JWT_SECRET"))},
	}))

	protected.Get("/me", GetCurrentUser)

	// Broadcasts
	protected.Get("/broadcasts", GetBroadcasts)
	protected.Get("/broadcasts/studio/:studioCode", GetBroadcastByStudioCode)
	protected.Post("/broadcasts", CreateBroadcast)
	protected.Put("/broadcasts/:id", UpdateBroadcast)
	protected.Delete("/broadcasts/:id", DeleteBroadcast)

	// Streaming Targets
	protected.Get("/broadcasts/:id/targets", GetStreamingTargets)
	protected.Post("/broadcasts/:id/targets", AddStreamingTarget)
	protected.Delete("/broadcasts/:id/targets/:targetId", DeleteStreamingTarget)

	// LiveKit & Egress
	protected.Post("/livekit/token", CreateLiveKitToken)
	protected.Post("/broadcasts/studio/:studioCode/start-egress", StartEgress)
	protected.Post("/broadcasts/studio/:studioCode/stop-egress", StopEgress)

	log.Fatal(app.Listen(":8000"))
}

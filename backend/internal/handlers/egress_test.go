package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http/httptest"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	lk_protocol "github.com/livekit/protocol/livekit"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"
)

func TestUniqueStreamURLs(t *testing.T) {
	targets := []models.StreamingTarget{
		{RTMPUrl: "rtmp://a.rtmp.youtube.com/live2", StreamKey: "yt"},
		{RTMPUrl: "rtmp://a.rtmp.youtube.com/live2/", StreamKey: "yt"}, // sondaki / farkı aynı adres
		{RTMPUrl: "rtmps://live.twitch.tv/app", StreamKey: "tw"},
	}
	got := uniqueStreamURLs(targets)
	want := []string{"rtmp://a.rtmp.youtube.com/live2/yt", "rtmps://live.twitch.tv/app/tw"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("beklenen %v, gelen %v", want, got)
	}
}

func TestEgressIDsOf(t *testing.T) {
	targets := []models.StreamingTarget{{EgressID: "EG_1"}, {}, {EgressID: "EG_1"}, {EgressID: "EG_2"}}
	if got := egressIDsOf(targets); !reflect.DeepEqual(got, []string{"EG_1", "EG_2"}) {
		t.Fatalf("beklenen [EG_1 EG_2], gelen %v", got)
	}
	if got := egressIDsOf(nil); len(got) != 0 {
		t.Fatalf("boş liste bekleniyordu, gelen %v", got)
	}
}

// fakeEgress, LiveKit egress servisini taklit eder ve yapılan çağrıları kaydeder.
type fakeEgress struct {
	mu       sync.Mutex
	starts   []*lk_protocol.TrackCompositeEgressRequest
	updates  []*lk_protocol.UpdateStreamRequest
	stops    []string
	active   map[string]bool
	nextID   int
	startErr error
	stopErr  error
}

func (f *fakeEgress) StartTrackCompositeEgress(_ context.Context, req *lk_protocol.TrackCompositeEgressRequest) (*lk_protocol.EgressInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.starts = append(f.starts, req)
	if f.startErr != nil {
		return nil, f.startErr
	}
	f.nextID++
	id := fmt.Sprintf("EG_%d", f.nextID)
	f.active[id] = true
	return &lk_protocol.EgressInfo{EgressId: id}, nil
}

func (f *fakeEgress) UpdateStream(_ context.Context, req *lk_protocol.UpdateStreamRequest) (*lk_protocol.EgressInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.updates = append(f.updates, req)
	return &lk_protocol.EgressInfo{EgressId: req.EgressId}, nil
}

func (f *fakeEgress) StopEgress(_ context.Context, req *lk_protocol.StopEgressRequest) (*lk_protocol.EgressInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.stops = append(f.stops, req.EgressId)
	if f.stopErr != nil {
		return nil, f.stopErr
	}
	if !f.active[req.EgressId] {
		return nil, errors.New("twirp error not_found: egress not found")
	}
	delete(f.active, req.EgressId)
	return &lk_protocol.EgressInfo{EgressId: req.EgressId}, nil
}

func (f *fakeEgress) ListEgress(_ context.Context, _ *lk_protocol.ListEgressRequest) (*lk_protocol.ListEgressResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	res := &lk_protocol.ListEgressResponse{}
	for id := range f.active {
		res.Items = append(res.Items, &lk_protocol.EgressInfo{EgressId: id})
	}
	return res, nil
}

type egressFixture struct {
	app       *fiber.App
	fake      *fakeEgress
	broadcast models.Broadcast
}

// newEgressFixture, gerçek bir Postgres'e karşı çalışır; TEST_DB_SOURCE verilmezse test atlanır.
func newEgressFixture(t *testing.T) *egressFixture {
	dsn := os.Getenv("TEST_DB_SOURCE")
	if dsn == "" {
		t.Skip("TEST_DB_SOURCE ayarlı değil; veritabanı gerektiren egress testleri atlandı")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("veritabanına bağlanılamadı: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Destination{}, &models.Broadcast{}, &models.StreamingTarget{}); err != nil {
		t.Fatalf("migration: %v", err)
	}
	prevDB, prevClient := database.DB, newEgressClient
	database.DB = db
	fake := &fakeEgress{active: map[string]bool{}}
	newEgressClient = func() egressAPI { return fake }

	suffix := time.Now().UnixNano()
	user := models.User{Email: fmt.Sprintf("egress-test-%d@example.com", suffix), PasswordHash: "x"}
	db.Create(&user)
	broadcast := models.Broadcast{UserID: user.ID, Title: "Egress testi", StudioCode: fmt.Sprintf("egress-test-%d", suffix)}
	db.Create(&broadcast)
	t.Cleanup(func() {
		db.Where("broadcast_id = ?", broadcast.ID).Delete(&models.StreamingTarget{})
		db.Delete(&broadcast)
		db.Delete(&user)
		database.DB, newEgressClient = prevDB, prevClient
	})

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user", &jwt.Token{Claims: jwt.MapClaims{"user_id": float64(user.ID)}})
		return c.Next()
	})
	app.Post("/studio/:studioCode/start-egress", StartEgress)
	app.Post("/studio/:studioCode/stop-egress", StopEgress)
	return &egressFixture{app: app, fake: fake, broadcast: broadcast}
}

func (f *egressFixture) addTarget(t *testing.T, name, url, key string) models.StreamingTarget {
	target := models.StreamingTarget{BroadcastID: f.broadcast.ID, Platform: name, Name: name, RTMPUrl: url, StreamKey: key}
	if err := database.DB.Create(&target).Error; err != nil {
		t.Fatalf("hedef eklenemedi: %v", err)
	}
	return target
}

func (f *egressFixture) post(t *testing.T, action string, body any) (int, map[string]any) {
	payload, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", fmt.Sprintf("/studio/%s/%s", f.broadcast.StudioCode, action), bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	res, err := f.app.Test(req, -1)
	if err != nil {
		t.Fatalf("istek başarısız: %v", err)
	}
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func (f *egressFixture) egressIDs(t *testing.T) map[string]string {
	var targets []models.StreamingTarget
	database.DB.Where("broadcast_id = ?", f.broadcast.ID).Find(&targets)
	ids := map[string]string{}
	for _, tg := range targets {
		ids[tg.Name] = tg.EgressID
	}
	return ids
}

var startBody = map[string]any{"trackId": "TR_video", "audioTrackId": "TR_audio", "quality": "1080p", "fps": 60}

func TestEgressSingleEncodeForAllTargets(t *testing.T) {
	f := newEgressFixture(t)
	f.addTarget(t, "YouTube", "rtmp://a.rtmp.youtube.com/live2", "yt")
	f.addTarget(t, "Twitch", "rtmps://live.twitch.tv/app", "tw")
	f.addTarget(t, "Kick", "rtmps://kick.example/app", "kk")

	t.Run("tüm hedefler tek egress ile başlar", func(t *testing.T) {
		code, body := f.post(t, "start-egress", startBody)
		if code != 200 {
			t.Fatalf("200 bekleniyordu, gelen %d: %v", code, body)
		}
		if len(f.fake.starts) != 1 {
			t.Fatalf("tek egress bekleniyordu, %d başlatıldı", len(f.fake.starts))
		}
		urls := f.fake.starts[0].GetStream().GetUrls()
		want := []string{"rtmp://a.rtmp.youtube.com/live2/yt", "rtmps://live.twitch.tv/app/tw", "rtmps://kick.example/app/kk"}
		if !reflect.DeepEqual(urls, want) {
			t.Fatalf("adresler %v bekleniyordu, gelen %v", want, urls)
		}
		enc := f.fake.starts[0].GetAdvanced()
		if enc.Width != 1920 || enc.Height != 1080 || enc.Framerate != 60 {
			t.Fatalf("1080p60 bekleniyordu, gelen %dx%d@%d", enc.Width, enc.Height, enc.Framerate)
		}
		for name, id := range f.egressIDs(t) {
			if id != "EG_1" {
				t.Fatalf("%s hedefi EG_1'e bağlı olmalıydı, gelen %q", name, id)
			}
		}
		if n := len(body["started"].([]any)); n != 3 {
			t.Fatalf("3 başlayan hedef bekleniyordu, gelen %d", n)
		}
	})

	t.Run("yayındayken eklenen hedef çalışan egress'e eklenir", func(t *testing.T) {
		f.addTarget(t, "Facebook", "rtmps://live-api-s.facebook.com:443/rtmp", "fb")
		code, body := f.post(t, "start-egress", startBody)
		if code != 200 {
			t.Fatalf("200 bekleniyordu, gelen %d: %v", code, body)
		}
		if len(f.fake.starts) != 1 {
			t.Fatalf("yeni egress başlatılmamalıydı, toplam %d", len(f.fake.starts))
		}
		if len(f.fake.updates) != 1 || f.fake.updates[0].EgressId != "EG_1" ||
			!reflect.DeepEqual(f.fake.updates[0].AddOutputUrls, []string{"rtmps://live-api-s.facebook.com:443/rtmp/fb"}) {
			t.Fatalf("EG_1'e yalnızca Facebook adresi eklenmeliydi, gelen %+v", f.fake.updates)
		}
		if id := f.egressIDs(t)["Facebook"]; id != "EG_1" {
			t.Fatalf("Facebook EG_1'e bağlı olmalıydı, gelen %q", id)
		}
	})

	t.Run("yeniden bağlanmada egress bir kez durdurulup tek egress ile yeniden başlar", func(t *testing.T) {
		body := map[string]any{"trackId": "TR_video2", "audioTrackId": "TR_audio2", "quality": "1080p", "fps": 60, "restart": true}
		code, resp := f.post(t, "start-egress", body)
		if code != 200 {
			t.Fatalf("200 bekleniyordu, gelen %d: %v", code, resp)
		}
		if !reflect.DeepEqual(f.fake.stops, []string{"EG_1"}) {
			t.Fatalf("EG_1 bir kez durdurulmalıydı, gelen %v", f.fake.stops)
		}
		if len(f.fake.starts) != 2 || f.fake.starts[1].VideoTrackId != "TR_video2" || len(f.fake.starts[1].GetStream().GetUrls()) != 4 {
			t.Fatalf("yeni izlerle 4 adreslik tek egress bekleniyordu, gelen %d başlatma", len(f.fake.starts))
		}
		for name, id := range f.egressIDs(t) {
			if id != "EG_2" {
				t.Fatalf("%s hedefi EG_2'ye bağlı olmalıydı, gelen %q", name, id)
			}
		}
	})

	t.Run("durdurma egress'i bir kez durdurur ve yayını bitirir", func(t *testing.T) {
		f.fake.stops = nil
		code, body := f.post(t, "stop-egress", nil)
		if code != 200 {
			t.Fatalf("200 bekleniyordu, gelen %d: %v", code, body)
		}
		if !reflect.DeepEqual(f.fake.stops, []string{"EG_2"}) {
			t.Fatalf("EG_2 bir kez durdurulmalıydı, gelen %v", f.fake.stops)
		}
		for name, id := range f.egressIDs(t) {
			if id != "" {
				t.Fatalf("%s hedefinin egress kimliği temizlenmeliydi, gelen %q", name, id)
			}
		}
		var b models.Broadcast
		database.DB.First(&b, f.broadcast.ID)
		if b.Status != models.BroadcastStatusEnded {
			t.Fatalf("yayın durumu ended olmalıydı, gelen %q", b.Status)
		}
	})
}

func TestEgressStartFailureMarksAllTargetsFailed(t *testing.T) {
	f := newEgressFixture(t)
	f.addTarget(t, "YouTube", "rtmp://a.rtmp.youtube.com/live2", "yt")
	f.addTarget(t, "Twitch", "rtmps://live.twitch.tv/app", "tw")
	f.fake.startErr = errors.New("no response from servers")

	code, body := f.post(t, "start-egress", startBody)
	if code != 502 {
		t.Fatalf("502 bekleniyordu, gelen %d: %v", code, body)
	}
	if n := len(body["failed"].([]any)); n != 2 {
		t.Fatalf("2 başarısız hedef bekleniyordu, gelen %d", n)
	}
	for name, id := range f.egressIDs(t) {
		if id != "" {
			t.Fatalf("%s hedefine egress kimliği yazılmamalıydı, gelen %q", name, id)
		}
	}
}

func TestEgressStopHandlesLegacyAndFailures(t *testing.T) {
	f := newEgressFixture(t)
	yt := f.addTarget(t, "YouTube", "rtmp://a.rtmp.youtube.com/live2", "yt")
	tw := f.addTarget(t, "Twitch", "rtmps://live.twitch.tv/app", "tw")
	// Hedef başına egress açan eski sürümden kalmış bir yayın
	database.DB.Model(&yt).Update("egress_id", "EG_old_1")
	database.DB.Model(&tw).Update("egress_id", "EG_old_2")
	f.fake.active["EG_old_1"], f.fake.active["EG_old_2"] = true, true

	t.Run("durdurulamayan egress'in kimliği korunur", func(t *testing.T) {
		f.fake.stopErr = errors.New("connection refused")
		code, body := f.post(t, "stop-egress", nil)
		if code != 502 {
			t.Fatalf("502 bekleniyordu, gelen %d: %v", code, body)
		}
		if n := len(body["still_running"].([]any)); n != 2 {
			t.Fatalf("2 hedef hâlâ yayında görünmeliydi, gelen %d", n)
		}
		if ids := f.egressIDs(t); ids["YouTube"] != "EG_old_1" || ids["Twitch"] != "EG_old_2" {
			t.Fatalf("kimlikler korunmalıydı, gelen %v", ids)
		}
	})

	t.Run("eski sürümün her egress'i ayrı durdurulur", func(t *testing.T) {
		f.fake.stopErr, f.fake.stops = nil, nil
		code, body := f.post(t, "stop-egress", nil)
		if code != 200 {
			t.Fatalf("200 bekleniyordu, gelen %d: %v", code, body)
		}
		if !reflect.DeepEqual(f.fake.stops, []string{"EG_old_1", "EG_old_2"}) {
			t.Fatalf("iki eski egress de durdurulmalıydı, gelen %v", f.fake.stops)
		}
	})
}

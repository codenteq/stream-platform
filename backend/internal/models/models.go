package models

import (
	"time"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `json:"name"`
	Email        string    `gorm:"unique;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}

// Destination, kullanıcının hesap seviyesinde bağladığı yayın hedefidir.
// Yayınlar bu hedeflerden seçim yapar.
type Destination struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Platform  string    `gorm:"not null" json:"platform"`
	Name      string    `json:"name"`
	RTMPUrl   string    `gorm:"not null" json:"rtmp_url"`
	StreamKey string    `gorm:"not null" json:"stream_key"`
	CreatedAt time.Time `json:"created_at"`
}

const (
	BroadcastStatusDraft     = "draft"
	BroadcastStatusScheduled = "scheduled"
	BroadcastStatusLive      = "live"
	BroadcastStatusEnded     = "ended"
)

type Broadcast struct {
	ID            uint              `gorm:"primaryKey" json:"id"`
	UserID        uint              `gorm:"not null" json:"user_id"`
	User          User              `gorm:"foreignKey:UserID" json:"user"`
	Title         string            `gorm:"not null" json:"title"`
	Description   string            `json:"description"`
	StudioCode    string            `gorm:"unique;not null" json:"studio_code"`
	Status        string            `gorm:"default:draft" json:"status"`
	ScheduledAt   *time.Time        `json:"scheduled_at"`
	StartedAt     *time.Time        `json:"started_at"`
	EndedAt       *time.Time        `json:"ended_at"`
	LogoURL       string            `gorm:"type:text" json:"logo_url"`
	ShowLogo      bool              `json:"show_logo"`
	OverlayURL    string            `gorm:"type:text" json:"overlay_url"`
	ShowOverlay   bool              `json:"show_overlay"`
	BackgroundURL string            `gorm:"type:text" json:"background_url"`
	BrandColor    string            `json:"brand_color"`
	Theme         string            `json:"theme"`
	ShowNames     bool              `gorm:"default:true" json:"show_names"`
	Banners       string            `gorm:"type:text" json:"banners"` // JSON dizi: [{id,text,ticker}]
	Targets       []StreamingTarget `gorm:"foreignKey:BroadcastID" json:"targets"`
	CreatedAt     time.Time         `json:"created_at"`
}

type StreamingTarget struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	BroadcastID   uint      `gorm:"not null" json:"broadcast_id"`
	DestinationID *uint     `gorm:"index" json:"destination_id"`
	Platform      string    `gorm:"not null" json:"platform"`
	Name          string    `json:"name"`
	RTMPUrl       string    `gorm:"not null" json:"rtmp_url"`
	StreamKey     string    `gorm:"not null" json:"stream_key"`
	EgressID      string    `json:"egress_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// --- API INPUTS ---

type AuthInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UpdateProfileInput struct {
	Name string `json:"name"`
}

// BroadcastInput kısmi güncellemeye izin verir: gönderilmeyen alanlar (nil) değişmez.
type BroadcastInput struct {
	Title          *string    `json:"title"`
	Description    *string    `json:"description"`
	ScheduledAt    *time.Time `json:"scheduled_at"`
	ClearSchedule  bool       `json:"clear_schedule"`
	LogoURL        *string    `json:"logo_url"`
	ShowLogo       *bool      `json:"show_logo"`
	OverlayURL     *string    `json:"overlay_url"`
	ShowOverlay    *bool      `json:"show_overlay"`
	BackgroundURL  *string    `json:"background_url"`
	BrandColor     *string    `json:"brand_color"`
	Theme          *string    `json:"theme"`
	ShowNames      *bool      `json:"show_names"`
	Banners        *string    `json:"banners"`
	DestinationIDs *[]uint    `json:"destination_ids"`
}

type DestinationInput struct {
	Platform  string `json:"platform"`
	Name      string `json:"name"`
	RTMPUrl   string `json:"rtmp_url"`
	StreamKey string `json:"stream_key"`
}

type LiveKitTokenInput struct {
	Room string `json:"room"`
	Name string `json:"name"`
}

type TrackEgressInput struct {
	TrackID      string `json:"trackId"`
	AudioTrackID string `json:"audioTrackId"`
	Quality      string `json:"quality"`
	FPS          int32  `json:"fps"`
	VideoBitrate int32  `json:"videoBitrate"` // kbps cinsinden, 0 ise varsayılan kullanılır
	AudioBitrate int32  `json:"audioBitrate"` // kbps cinsinden, 0 ise varsayılan 128 kullanılır
	// Restart, yayındaki egress'leri durdurup yeni iz kimlikleriyle yeniden başlatır
	// (ör. yeniden bağlanma veya sayfa yenileme sonrası izler yeniden yayınlandığında).
	Restart bool `json:"restart"`
}

type StreamingTargetInput struct {
	Platform  string `json:"platform"`
	RTMPUrl   string `json:"rtmp_url"`
	StreamKey string `json:"stream_key"`
}

type JoinStudioInput struct {
	StudioCode string `json:"studioCode"`
	Name       string `json:"name"`
}

type ParticipantActionInput struct {
	Identity string `json:"identity"`
	TrackSid string `json:"trackSid"`
}

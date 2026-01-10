package models

import (
	"time"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"unique;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	CreatedAt    time.Time `json:"created_at"`
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
	ID          uint      `gorm:"primaryKey" json:"id"`
	BroadcastID uint      `gorm:"not null" json:"broadcast_id"`
	Platform    string    `gorm:"not null" json:"platform"`
	RTMPUrl     string    `gorm:"not null" json:"rtmp_url"`
	StreamKey   string    `gorm:"not null" json:"stream_key"`
	EgressID    string    `json:"egress_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
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
	VideoBitrate int32  `json:"videoBitrate"` // kbps cinsinden, 0 ise varsayılan kullanılır
	AudioBitrate int32  `json:"audioBitrate"` // kbps cinsinden, 0 ise varsayılan 128 kullanılır
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

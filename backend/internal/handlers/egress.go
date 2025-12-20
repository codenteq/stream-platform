package handlers

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/livekit/protocol/auth"
	lk_protocol "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"
)

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

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	// Determine encoding options based on quality and FPS
	var width, height, videoBitrate int32
	fps := input.FPS
	if fps <= 0 {
		fps = 30
	}

	switch input.Quality {
	case "1080p":
		// High bitrate for screen share text readability
		width, height, videoBitrate = 1920, 1080, 10000
	case "720p":
		width, height, videoBitrate = 1280, 720, 6000
	case "480p":
		width, height, videoBitrate = 854, 480, 3000
	default:
		width, height, videoBitrate = 854, 480, 3000
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
			continue
		}

		target.EgressID = egress.EgressId
		database.DB.Save(&target)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Egress processes started"})
}

func StopEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")

	var broadcast models.Broadcast
	if result := database.DB.Preload("Targets").First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
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
				continue
			}
			target.EgressID = ""
			database.DB.Save(&target)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Egress processes stopped"})
}

func CreateLiveKitToken(c *fiber.Ctx) error {
	input := new(models.LiveKitTokenInput)
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

func JoinStudioPublic(c *fiber.Ctx) error {
	input := new(models.JoinStudioInput)
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

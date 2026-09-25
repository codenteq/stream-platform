package handlers

import (
	"strings"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func GetBroadcasts(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var broadcasts []models.Broadcast

	// Liste görünümünde büyük görsel alanları (data URL olabilir) gönderilmez.
	database.DB.Omit("overlay_url", "background_url", "banners").Order("created_at desc").Where("user_id = ?", userId).Preload("Targets").Find(&broadcasts)

	return c.JSON(broadcasts)
}

func GetBroadcastByStudioCode(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")

	var broadcast models.Broadcast
	if result := database.DB.Preload("Targets").First(&broadcast, "studio_code = ? AND user_id = ?", studioCode, userId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	return c.JSON(broadcast)
}

// GetPublicStudioInfo, misafirlerin bekleme odasında (lobby) göreceği asgari bilgiyi döner.
func GetPublicStudioInfo(c *fiber.Ctx) error {
	studioCode := c.Params("studioCode")

	var broadcast models.Broadcast
	if result := database.DB.Preload("User").First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Studio not found"})
	}

	hostName := broadcast.User.Name
	if hostName == "" {
		hostName = strings.Split(broadcast.User.Email, "@")[0]
	}

	return c.JSON(fiber.Map{
		"title":     broadcast.Title,
		"status":    broadcast.Status,
		"host_name": hostName,
	})
}

func CreateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(models.BroadcastInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	if input.Title == nil || strings.TrimSpace(*input.Title) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Title is required"})
	}

	broadcast := models.Broadcast{
		Title:      strings.TrimSpace(*input.Title),
		UserID:     userId,
		StudioCode: uuid.New().String(),
		Status:     models.BroadcastStatusDraft,
		BrandColor: "#2446d8",
		Theme:      "default",
		ShowNames:  true,
		Banners:    "[]",
	}
	if input.Description != nil {
		broadcast.Description = *input.Description
	}
	if input.ScheduledAt != nil {
		broadcast.ScheduledAt = input.ScheduledAt
		broadcast.Status = models.BroadcastStatusScheduled
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&broadcast).Error; err != nil {
			return err
		}
		if input.DestinationIDs != nil {
			return syncBroadcastTargets(tx, &broadcast, userId, *input.DestinationIDs)
		}
		return nil
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create broadcast"})
	}

	database.DB.Preload("Targets").First(&broadcast, broadcast.ID)
	return c.Status(fiber.StatusCreated).JSON(broadcast)
}

func UpdateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	input := new(models.BroadcastInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast models.Broadcast
	if result := database.DB.First(&broadcast, broadcastId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to edit this broadcast"})
	}

	if input.Title != nil && strings.TrimSpace(*input.Title) != "" {
		broadcast.Title = strings.TrimSpace(*input.Title)
	}
	if input.Description != nil {
		broadcast.Description = *input.Description
	}
	if input.ClearSchedule {
		broadcast.ScheduledAt = nil
		if broadcast.Status == models.BroadcastStatusScheduled {
			broadcast.Status = models.BroadcastStatusDraft
		}
	} else if input.ScheduledAt != nil {
		broadcast.ScheduledAt = input.ScheduledAt
		if broadcast.Status == models.BroadcastStatusDraft {
			broadcast.Status = models.BroadcastStatusScheduled
		}
	}
	if input.LogoURL != nil {
		broadcast.LogoURL = *input.LogoURL
	}
	if input.ShowLogo != nil {
		broadcast.ShowLogo = *input.ShowLogo
	}
	if input.OverlayURL != nil {
		broadcast.OverlayURL = *input.OverlayURL
	}
	if input.ShowOverlay != nil {
		broadcast.ShowOverlay = *input.ShowOverlay
	}
	if input.BackgroundURL != nil {
		broadcast.BackgroundURL = *input.BackgroundURL
	}
	if input.BrandColor != nil {
		broadcast.BrandColor = *input.BrandColor
	}
	if input.Theme != nil {
		broadcast.Theme = *input.Theme
	}
	if input.ShowNames != nil {
		broadcast.ShowNames = *input.ShowNames
	}
	if input.Banners != nil {
		broadcast.Banners = *input.Banners
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&broadcast).Error; err != nil {
			return err
		}
		if input.DestinationIDs != nil {
			return syncBroadcastTargets(tx, &broadcast, userId, *input.DestinationIDs)
		}
		return nil
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update broadcast"})
	}

	database.DB.Preload("Targets").First(&broadcast, broadcast.ID)
	return c.JSON(broadcast)
}

func DeleteBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")

	var broadcast models.Broadcast
	if result := database.DB.First(&broadcast, broadcastId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to delete this broadcast"})
	}
	// Also delete associated targets
	if err := database.DB.Where("broadcast_id = ?", broadcast.ID).Delete(&models.StreamingTarget{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete associated targets"})
	}

	if result := database.DB.Delete(&broadcast); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete broadcast"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// syncBroadcastTargets, yayına bağlı hedefleri seçilen hesap hedefleriyle eşitler.
// Yalnızca hesap hedefinden türeyen (destination_id dolu) ve o an yayında olmayan
// kayıtlar silinir; eski tip yayına özel hedeflere dokunulmaz.
func syncBroadcastTargets(tx *gorm.DB, broadcast *models.Broadcast, userId uint, destinationIDs []uint) error {
	var destinations []models.Destination
	if len(destinationIDs) > 0 {
		if err := tx.Where("user_id = ? AND id IN ?", userId, destinationIDs).Find(&destinations).Error; err != nil {
			return err
		}
	}

	wanted := make(map[uint]models.Destination, len(destinations))
	for _, d := range destinations {
		wanted[d.ID] = d
	}

	var existing []models.StreamingTarget
	if err := tx.Where("broadcast_id = ? AND destination_id IS NOT NULL", broadcast.ID).Find(&existing).Error; err != nil {
		return err
	}

	have := make(map[uint]bool, len(existing))
	for _, t := range existing {
		if _, ok := wanted[*t.DestinationID]; ok {
			have[*t.DestinationID] = true
			continue
		}
		if t.EgressID != "" {
			// Yayında olan hedef, yayın bitene kadar korunur.
			have[*t.DestinationID] = true
			continue
		}
		if err := tx.Delete(&t).Error; err != nil {
			return err
		}
	}

	for id, d := range wanted {
		if have[id] {
			continue
		}
		destID := d.ID
		target := models.StreamingTarget{
			BroadcastID:   broadcast.ID,
			DestinationID: &destID,
			Platform:      d.Platform,
			Name:          d.Name,
			RTMPUrl:       d.RTMPUrl,
			StreamKey:     d.StreamKey,
		}
		if err := tx.Create(&target).Error; err != nil {
			return err
		}
	}
	return nil
}

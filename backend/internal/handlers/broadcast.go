package handlers

import (
	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func GetBroadcasts(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var broadcasts []models.Broadcast

	database.DB.Order("created_at desc").Where("user_id = ?", userId).Preload("Targets").Find(&broadcasts)

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

func CreateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(models.BroadcastInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	broadcast := models.Broadcast{
		Title:      input.Title,
		UserID:     userId,
		StudioCode: uuid.New().String(),
	}

	if result := database.DB.Create(&broadcast); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create broadcast"})
	}

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

	broadcast.Title = input.Title
	broadcast.LogoURL = input.LogoURL
	broadcast.ShowLogo = input.ShowLogo
	broadcast.OverlayURL = input.OverlayURL
	broadcast.ShowOverlay = input.ShowOverlay
	database.DB.Save(&broadcast)

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

package handlers

import (
	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func GetStreamingTargets(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")

	var broadcast models.Broadcast
	if err := database.DB.First(&broadcast, "id = ? AND user_id = ?", broadcastId, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found or you are not authorized"})
	}

	var targets []models.StreamingTarget
	database.DB.Where("broadcast_id = ?", broadcastId).Find(&targets)

	return c.JSON(targets)
}

func AddStreamingTarget(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	input := new(models.StreamingTargetInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast models.Broadcast
	if err := database.DB.First(&broadcast, "id = ? AND user_id = ?", broadcastId, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found or you are not authorized"})
	}

	target := models.StreamingTarget{
		BroadcastID: broadcast.ID,
		Platform:    input.Platform,
		RTMPUrl:     input.RTMPUrl,
		StreamKey:   input.StreamKey,
	}

	if result := database.DB.Create(&target); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create streaming target"})
	}

	return c.Status(fiber.StatusCreated).JSON(target)
}

func DeleteStreamingTarget(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	targetId := c.Params("targetId")

	var broadcast models.Broadcast
	if err := database.DB.First(&broadcast, "id = ? AND user_id = ?", broadcastId, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found or you are not authorized"})
	}

	var target models.StreamingTarget
	if err := database.DB.First(&target, "id = ? AND broadcast_id = ?", targetId, broadcast.ID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Target not found"})
	}

	if result := database.DB.Delete(&target); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete streaming target"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

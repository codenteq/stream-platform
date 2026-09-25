package handlers

import (
	"strings"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func GetDestinations(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var destinations []models.Destination
	database.DB.Order("created_at asc").Where("user_id = ?", userId).Find(&destinations)
	return c.JSON(destinations)
}

func validateDestinationInput(input *models.DestinationInput) string {
	input.Platform = strings.TrimSpace(input.Platform)
	input.Name = strings.TrimSpace(input.Name)
	input.RTMPUrl = strings.TrimSpace(input.RTMPUrl)
	input.StreamKey = strings.TrimSpace(input.StreamKey)

	if input.Platform == "" {
		return "Platform is required"
	}
	if !strings.HasPrefix(input.RTMPUrl, "rtmp://") && !strings.HasPrefix(input.RTMPUrl, "rtmps://") {
		return "RTMP URL must start with rtmp:// or rtmps://"
	}
	if input.StreamKey == "" {
		return "Stream key is required"
	}
	if input.Name == "" {
		input.Name = input.Platform
	}
	return ""
}

func CreateDestination(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(models.DestinationInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}
	if msg := validateDestinationInput(input); msg != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": msg})
	}

	destination := models.Destination{
		UserID:    userId,
		Platform:  input.Platform,
		Name:      input.Name,
		RTMPUrl:   input.RTMPUrl,
		StreamKey: input.StreamKey,
	}
	if err := database.DB.Create(&destination).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create destination"})
	}
	return c.Status(fiber.StatusCreated).JSON(destination)
}

func UpdateDestination(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(models.DestinationInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}
	if msg := validateDestinationInput(input); msg != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": msg})
	}

	destinationID, ok := paramID(c, "id")
	if !ok {
		return invalidID(c)
	}
	var destination models.Destination
	if err := database.DB.First(&destination, "id = ? AND user_id = ?", destinationID, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destination not found"})
	}

	destination.Platform = input.Platform
	destination.Name = input.Name
	destination.RTMPUrl = input.RTMPUrl
	destination.StreamKey = input.StreamKey
	database.DB.Save(&destination)

	// Yayında olmayan bağlı hedefleri de güncel tut.
	database.DB.Model(&models.StreamingTarget{}).
		Where("destination_id = ? AND (egress_id = '' OR egress_id IS NULL)", destination.ID).
		Updates(map[string]interface{}{
			"platform":   destination.Platform,
			"name":       destination.Name,
			"rtmp_url":   destination.RTMPUrl,
			"stream_key": destination.StreamKey,
		})

	return c.JSON(destination)
}

func DeleteDestination(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)

	destinationID, ok := paramID(c, "id")
	if !ok {
		return invalidID(c)
	}
	var destination models.Destination
	if err := database.DB.First(&destination, "id = ? AND user_id = ?", destinationID, userId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destination not found"})
	}

	database.DB.Where("destination_id = ? AND (egress_id = '' OR egress_id IS NULL)", destination.ID).Delete(&models.StreamingTarget{})
	if err := database.DB.Delete(&destination).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete destination"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

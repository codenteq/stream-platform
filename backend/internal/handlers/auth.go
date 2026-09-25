package handlers

import (
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/models"
)

func getUserIdFromToken(c *fiber.Ctx) uint {
	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	userId := uint(claims["user_id"].(float64))
	return userId
}

func Register(c *fiber.Ctx) error {
	input := new(models.AuthInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if input.Email == "" || len(input.Password) < 6 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "E-posta ve en az 6 karakterli şifre gerekli"})
	}

	user := models.User{Name: strings.TrimSpace(input.Name), Email: input.Email, PasswordHash: string(hashedPassword)}

	if result := database.DB.Create(&user); result.Error != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email already exists"})
	}

	return c.Status(fiber.StatusCreated).JSON(user)
}

func Login(c *fiber.Ctx) error {
	input := new(models.AuthInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var user models.User
	if result := database.DB.First(&user, "email = ?", strings.TrimSpace(strings.ToLower(input.Email))); result.Error != nil {
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

func GetCurrentUser(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var user models.User
	if result := database.DB.First(&user, userId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

func UpdateCurrentUser(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(models.UpdateProfileInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var user models.User
	if result := database.DB.First(&user, userId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	user.Name = strings.TrimSpace(input.Name)
	database.DB.Save(&user)
	return c.JSON(user)
}

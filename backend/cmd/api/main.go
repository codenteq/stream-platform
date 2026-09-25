package main

import (
	"log"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	database.ConnectDatabase()

	// Marka görselleri (logo, overlay, arka plan) data URL olarak gönderilebildiği için
	// varsayılan 4MB gövde sınırı yükseltildi.
	app := fiber.New(fiber.Config{BodyLimit: 16 * 1024 * 1024})
	// Bir handler'daki panic tüm sunucuyu düşürmesin; 500 dönülsün
	app.Use(recover.New())

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello from Go Backend! Broadcast management is ready.")
	})

	routes.SetupRoutes(app)

	log.Fatal(app.Listen(":8000"))
}

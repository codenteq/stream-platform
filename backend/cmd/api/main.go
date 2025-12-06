package main

import (
	"log"

	"stream-platform/backend/internal/database"
	"stream-platform/backend/internal/routes"

	"github.com/gofiber/fiber/v2"
)

func main() {
	database.ConnectDatabase()

	app := fiber.New()

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello from Go Backend! Broadcast management is ready.")
	})

	routes.SetupRoutes(app)

	log.Fatal(app.Listen(":8000"))
}

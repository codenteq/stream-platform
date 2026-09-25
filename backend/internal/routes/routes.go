package routes

import (
	"os"

	"stream-platform/backend/internal/handlers"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// Public routes
	api.Post("/register", handlers.Register)
	api.Post("/login", handlers.Login)
	api.Post("/public/join-studio", handlers.JoinStudioPublic)
	api.Get("/public/studio/:studioCode", handlers.GetPublicStudioInfo)

	// Protected routes
	protected := api.Group("/", jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(os.Getenv("JWT_SECRET"))},
	}))

	protected.Get("/me", handlers.GetCurrentUser)
	protected.Put("/me", handlers.UpdateCurrentUser)

	// Account-level destinations
	protected.Get("/destinations", handlers.GetDestinations)
	protected.Post("/destinations", handlers.CreateDestination)
	protected.Put("/destinations/:id", handlers.UpdateDestination)
	protected.Delete("/destinations/:id", handlers.DeleteDestination)

	// Broadcasts
	protected.Get("/broadcasts", handlers.GetBroadcasts)
	protected.Get("/broadcasts/studio/:studioCode", handlers.GetBroadcastByStudioCode)
	protected.Post("/broadcasts", handlers.CreateBroadcast)
	protected.Put("/broadcasts/:id", handlers.UpdateBroadcast)
	protected.Delete("/broadcasts/:id", handlers.DeleteBroadcast)

	// Streaming Targets
	protected.Get("/broadcasts/:id/targets", handlers.GetStreamingTargets)
	protected.Post("/broadcasts/:id/targets", handlers.AddStreamingTarget)
	protected.Delete("/broadcasts/:id/targets/:targetId", handlers.DeleteStreamingTarget)

	// LiveKit & Egress
	protected.Post("/livekit/token", handlers.CreateLiveKitToken)
	protected.Post("/broadcasts/studio/:studioCode/start-egress", handlers.StartEgress)
	protected.Post("/broadcasts/studio/:studioCode/stop-egress", handlers.StopEgress)
	protected.Post("/broadcasts/studio/:studioCode/participants/remove", handlers.RemoveParticipant)
	protected.Post("/broadcasts/studio/:studioCode/participants/mute", handlers.MuteParticipant)
}

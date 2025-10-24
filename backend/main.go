package main

import (
	"context"
	"log"
	"os"
	"time"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"
	lk_protocol "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// --- MODELS ---
type User struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	Email        string `gorm:"unique;not null" json:"email"`
	PasswordHash string `gorm:"not null" json:"-"`
	CreatedAt    time.Time
}

type Broadcast struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"not null" json:"user_id"`
	User       User      `gorm:"foreignKey:UserID" json:"user"`
	Title      string    `gorm:"not null" json:"title"`
	StudioCode string    `gorm:"unique;not null" json:"studio_code"`
	EgressID   string    `json:"egress_id,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// --- DATABASE ---
var DB *gorm.DB
var restreamerClient *RestreamerClient

func ConnectDatabase() {
	var err error
	dsn := os.Getenv("DB_SOURCE")
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Database connection successful.")

	err = DB.AutoMigrate(&User{}, &Broadcast{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migration successful.")
}

// --- API INPUTS ---
type AuthInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type BroadcastInput struct {
	Title string `json:"title"`
}

type LiveKitTokenInput struct {
	Room string `json:"room"`
}

type TrackEgressInput struct {
	TrackID string `json:"trackId"`
}

type DestinationInput struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// --- HANDLERS ---
func Register(c *fiber.Ctx) error {
	input := new(AuthInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	user := User{Email: input.Email, PasswordHash: string(hashedPassword)}

	if result := DB.Create(&user); result.Error != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email already exists"})
	}

	return c.Status(fiber.StatusCreated).JSON(user)
}

func Login(c *fiber.Ctx) error {
	input := new(AuthInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var user User
	if result := DB.First(&user, "email = ?", input.Email); result.Error != nil {
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

func getUserIdFromToken(c *fiber.Ctx) uint {
	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	userId := uint(claims["user_id"].(float64))
	return userId
}

func GetCurrentUser(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var user User
	if result := DB.First(&user, userId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

func GetBroadcasts(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	var broadcasts []Broadcast

	DB.Order("created_at desc").Where("user_id = ?", userId).Find(&broadcasts)

	return c.JSON(broadcasts)
}

func CreateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	input := new(BroadcastInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	broadcast := Broadcast{
		Title:      input.Title,
		UserID:     userId,
		StudioCode: uuid.New().String(),
	}

	if result := DB.Create(&broadcast); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create broadcast"})
	}

	return c.Status(fiber.StatusCreated).JSON(broadcast)
}

func UpdateBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")
	input := new(BroadcastInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast Broadcast
	if result := DB.First(&broadcast, broadcastId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to edit this broadcast"})
	}

	broadcast.Title = input.Title
	DB.Save(&broadcast)

	return c.JSON(broadcast)
}

func DeleteBroadcast(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	broadcastId := c.Params("id")

	var broadcast Broadcast
	if result := DB.First(&broadcast, broadcastId); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to delete this broadcast"})
	}

	if result := DB.Delete(&broadcast); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete broadcast"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func StartTrackCompositeEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")
	input := new(TrackEgressInput)

	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	var broadcast Broadcast
	if result := DB.First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to start egress for this broadcast"})
	}

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	req := &lk_protocol.TrackCompositeEgressRequest{
		RoomName:     broadcast.StudioCode,
		VideoTrackId: input.TrackID,
		Output: &lk_protocol.TrackCompositeEgressRequest_Stream{
			Stream: &lk_protocol.StreamOutput{
				Protocol: lk_protocol.StreamProtocol_RTMP,
				Urls:     []string{"rtmp://restreamer:1935/live/stream"},
			},
		},
	}

	egress, err := egressClient.StartTrackCompositeEgress(context.Background(), req)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start track composite egress", "details": err.Error()})
	}

	broadcast.EgressID = egress.EgressId
	DB.Save(&broadcast)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Track Composite Egress started successfully", "egressId": egress.EgressId})
}

func StopEgress(c *fiber.Ctx) error {
	userId := getUserIdFromToken(c)
	studioCode := c.Params("studioCode")

	var broadcast Broadcast
	if result := DB.First(&broadcast, "studio_code = ?", studioCode); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Broadcast not found"})
	}

	if broadcast.UserID != userId {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You are not authorized to stop egress for this broadcast"})
	}

	if broadcast.EgressID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No active egress found for this broadcast"})
	}

	egressClient := lksdk.NewEgressClient(os.Getenv("LIVEKIT_HOST"), os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))

	_, err := egressClient.StopEgress(context.Background(), &lk_protocol.StopEgressRequest{
		EgressId: broadcast.EgressID,
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to stop egress", "details": err.Error()})
	}

	broadcast.EgressID = ""
	DB.Save(&broadcast)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Egress stopped successfully"})
}

func CreateLiveKitToken(c *fiber.Ctx) error {
	input := new(LiveKitTokenInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	participantIdentity := claims["email"].(string)

	at := auth.NewAccessToken(os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"))
	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     input.Room,
	}
	at.SetVideoGrant(grant).SetIdentity(participantIdentity).SetValidFor(time.Hour)

	token, err := at.ToJWT()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create LiveKit token"})
	}

	return c.JSON(fiber.Map{"token": token})
}

// --- Restreamer Handlers ---
func GetDestinations(c *fiber.Ctx) error {
	destinations, err := restreamerClient.GetDestinations()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get destinations", "details": err.Error()})
	}
	return c.JSON(destinations)
}

func AddDestination(c *fiber.Ctx) error {
	input := new(DestinationInput)
	if err := c.BodyParser(input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot parse JSON"})
	}

	newProcess, err := restreamerClient.AddDestination(input.Name, input.URL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add destination", "details": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(newProcess)
}

func DeleteDestination(c *fiber.Ctx) error {
	id := c.Params("id")
	err := restreamerClient.DeleteDestination(id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete destination", "details": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// --- MAIN ---
func main() {
	ConnectDatabase()

	var err error
	for i := 0; i < 5; i++ {
		restreamerClient, err = NewRestreamerClient(
			os.Getenv("RESTREAMER_HOST"),
			os.Getenv("RESTREAMER_USERNAME"),
			os.Getenv("RESTREAMER_PASSWORD"),
		)
		if err == nil {
			log.Println("Successfully connected to Restreamer.")
			break
		}
		log.Printf("Failed to connect to restreamer (attempt %d/5): %v", i+1, err)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Fatalf("Could not connect to Restreamer after multiple attempts: %v", err)
	}

	app := fiber.New()

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello from Go Backend! Broadcast management is ready.")
	})

	api := app.Group("/api")
	api.Post("/register", Register)
	api.Post("/login", Login)

	// Protected routes
	protected := api.Group("/", jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(os.Getenv("JWT_SECRET"))},
	}))

	protected.Get("/me", GetCurrentUser)
	protected.Get("/broadcasts", GetBroadcasts)
	protected.Post("/broadcasts", CreateBroadcast)
	protected.Put("/broadcasts/:id", UpdateBroadcast)
	protected.Delete("/broadcasts/:id", DeleteBroadcast)
	protected.Post("/livekit/token", CreateLiveKitToken)
	protected.Post("/broadcasts/studio/:studioCode/start-track-composite-egress", StartTrackCompositeEgress)
	protected.Post("/broadcasts/studio/:studioCode/stop-egress", StopEgress)

	// Restreamer Destination Routes
	protected.Get("/destinations", GetDestinations)
	protected.Post("/destinations", AddDestination)
	protected.Delete("/destinations/:id", DeleteDestination)

	log.Fatal(app.Listen(":8000"))
}

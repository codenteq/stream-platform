# Codenteq Stream

A browser-based live broadcast studio. Invite guests with a link, bring them on stage, brand your show, and stream to YouTube, Facebook, LinkedIn, Twitch, X, Kick or any RTMP server at the same time. Nothing to install: the host and guests only need a browser.

Built with Next.js, Go (Fiber), PostgreSQL and [LiveKit](https://livekit.io).

## Screenshots

![Landing page](docs/screenshots/landing.png)

|                                     Dashboard                                     |                                  Studio                                   |
| :---------------------------------------------------------------------------------: | :--------------------------------------------------------------------------: |
| ![Dashboard: list of upcoming and past broadcasts](docs/screenshots/dashboard.png) | ![Studio: stage, layouts and branding panel](docs/screenshots/studio.png) |

## Features

- **Multistreaming:** connect destinations once, then pick which ones each broadcast goes to. The show is encoded once and sent to all of them; if one destination drops, the others keep streaming.
- **Guests by link:** guests join from a link without an account. They wait backstage until the host adds them to the stage.
- **Backstage and stage:** only people on stage are seen and heard on air. Guests watch the program feed, so they see exactly what viewers see.
- **Seven layouts:** solo, thin, group, leader, screen + sidebar, picture-in-picture and cinema, switchable while live.
- **Branding:** brand color, five name-tag themes, logo, full-screen overlay and background image.
- **Banners and ticker:** prepared lower thirds and a scrolling ticker, shown with one click.
- **Screen sharing** with audio. The host's share goes on stage automatically.
- **Private chat** between everyone in the studio. It is never sent to the stream.
- **Local recording** of the studio output (MP4 or WebM). Where the browser supports it, the recording is written to disk as it goes instead of being held in memory.
- **Pre-join lobby** with camera preview, mic level meter and device selection.
- **Scheduling:** plan broadcasts ahead. They show under "Upcoming" on the dashboard.

## How it works

```mermaid
flowchart LR
  Host["Host browser<br/>canvas compositor + audio mixer"] -- WebRTC --> LK["LiveKit SFU"]
  Guest["Guest browser"] -- WebRTC --> LK
  LK -- "program feed" --> Guest
  LK --> Egress["LiveKit Egress"]
  Egress -- "RTMP / RTMPS" --> Dest["YouTube, Twitch, ..."]
  Host -- REST --> API["Go API (Fiber)"]
  API --> DB[("PostgreSQL")]
  API -- "start / stop egress" --> LK
```

The show is composed in the host's browser:

1. Everyone publishes their camera, mic and screen share to LiveKit.
2. The host draws the stage onto a `<canvas>`: layout, name tags, banners, logo and overlay. That canvas is published as a single `canvas-composite` video track.
3. A WebAudio mixer in the host's browser mixes the audio of on-stage participants only, and publishes it as a `broadcast-mix` track. A limiter prevents clipping, and an adjustable delay keeps audio in sync with the composited video.
4. When the host goes live, the API starts one LiveKit Egress job that encodes those two tracks once and pushes them to every selected destination over RTMP.
5. Guests subscribe to the composite track, so their preview matches the stream.

Because the composition happens in the browser, what the host sees is what goes on air, and the server side stays a standard LiveKit deployment.

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI, LiveKit Components |
| Backend | Go, Fiber, GORM, JWT auth |
| Database | PostgreSQL |
| Media | LiveKit server, LiveKit Egress, Redis |

## Quick start

Requirements: Docker with Docker Compose.

```bash
git clone https://github.com/codenteq/stream-platform.git
cd stream-platform
docker compose up --build -d
```

Then open <http://localhost:3001>, create an account, add a destination and create a broadcast.

The root compose file builds the frontend with local LiveKit and app URLs (`ws://localhost:7880`, `http://localhost:3001`). To build for another host, pass `NEXT_PUBLIC_LIVEKIT_WS_URL` and `NEXT_PUBLIC_APP_URL` as build args, as `production/docker-compose.yml` does.

| Service | Port |
| --- | --- |
| Frontend | 3001 |
| Backend API | 8000 |
| LiveKit | 7880 (HTTP/WebSocket), 7881, 7882 (TCP), 50400–50600 (UDP) |
| PostgreSQL | 5432 |

The database schema is created automatically on startup.

> The default keys in `docker-compose.yml`, `livekit.yaml` and `egress.yaml` are for local development only. Change them before exposing the stack anywhere.

## Local development

Start the infrastructure with Docker, then run the backend and frontend directly:

```bash
docker compose up -d db redis livekit egress
```

**Backend** (Go 1.24+):

```bash
cd backend
go mod tidy
DB_SOURCE="postgresql://user:password@localhost:5432/stream_db?sslmode=disable" \
LIVEKIT_HOST=http://localhost:7880 \
LIVEKIT_API_KEY=devkey \
LIVEKIT_API_SECRET=ThisIsAStrongAndSecureSecretKey32 \
JWT_SECRET=change-me \
go run ./cmd/api
```

**Frontend** (Node.js 18+):

```bash
cd frontend
npm install
BACKEND_URL=http://localhost:8000 npm run dev -- -p 3001
```

`frontend/.env.development` already points the browser at `ws://localhost:7880` for LiveKit.

## Configuration

### Backend

| Variable | Description |
| --- | --- |
| `DB_SOURCE` | PostgreSQL connection string |
| `LIVEKIT_HOST` | LiveKit server URL used for the server API, e.g. `http://livekit:7880` |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `JWT_SECRET` | Secret used to sign user session tokens |

### Frontend

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_LIVEKIT_WS_URL` | LiveKit WebSocket URL the browser connects to, e.g. `wss://stream.example.com` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app, used for guest invite links |
| `BACKEND_URL` | Where `/api/*` requests are proxied. Read at build time. Defaults to `http://backend:8000` |

## Project structure

```
backend/
  cmd/api/               entry point
  internal/handlers/     HTTP handlers (auth, broadcasts, destinations, egress)
  internal/models/       GORM models and request types
  internal/routes/       route definitions
  scripts/               API test scripts
frontend/
  app/                   pages: landing, auth, dashboard, studio
  components/studio/     studio UI: header, control bar, tiles, panels, dialogs
  components/app/        shared app UI: shell, dialogs, program monitor
  hooks/                 compositor, audio mixer, recorder, data channel
  lib/studio/            layout math, canvas drawing, studio types
production/              production compose file, Caddy config and deploy guide
.github/workflows/       release image builds
```

## Testing

Unit tests for input validation and error handling (no database needed):

```bash
cd backend
go test ./...
```

The go-live tests run the start, restart and stop flows against a fake egress service. They need a PostgreSQL database and are skipped unless `TEST_DB_SOURCE` is set:

```bash
TEST_DB_SOURCE="postgresql://user:password@localhost:5432/stream_db?sslmode=disable" go test ./...
```

Negative API tests run against a live backend. They cover authentication (missing, malformed, expired and wrongly signed tokens), ownership checks, isolation between users, and input validation:

```bash
API_URL=http://localhost:8000/api JWT_SECRET=change-me bash backend/scripts/api-negative-tests.sh
```

`JWT_SECRET` must match the backend's. It is only used by the signed-token tests, which are skipped (and reported as skipped) without it. The script needs `curl` and `python3`, with no extra packages.

## Deployment

See [production/DEPLOY.md](production/DEPLOY.md) for the production setup with Caddy and TLS.

Before going to production:

- Replace the LiveKit key and secret in `livekit.yaml`, `egress.yaml` and the backend environment, and set a strong `JWT_SECRET`.
- Egress runs a headless Chrome and needs enough shared memory; the compose file sets `shm_size: 2gb`.
- Open the LiveKit UDP port range so WebRTC media can reach the server.
- Egress encodes on the CPU. Plan about 2.5 dedicated vCPUs per live 1080p60 broadcast (about 1.5 at 1080p30), however many destinations it streams to, plus about 1.5 vCPUs for the rest of the stack.

### Docker images

Publishing a GitHub release builds the backend and frontend images and pushes them to GitHub Container Registry:

- `ghcr.io/codenteq/stream-platform-backend`
- `ghcr.io/codenteq/stream-platform-frontend`

A release tagged `v1.2.3` produces the tags `1.2.3`, `1.2` and `latest`. Pre-releases get only their full version, such as `1.3.0-rc.1`. The workflow can also be started by hand from the Actions tab; those images are tagged with the branch name, such as `main`.

The frontend image contains the LiveKit and app URLs it was built with. They default to `wss://stream.codenteq.com` and `https://stream.codenteq.com`. To build for another host, set the repository variables `NEXT_PUBLIC_LIVEKIT_WS_URL` and `NEXT_PUBLIC_APP_URL` under Settings → Secrets and variables → Actions → Variables.

While the repository is private, its packages are private too. Log in with a personal access token that has the `read:packages` scope before pulling:

```bash
echo "$TOKEN" | docker login ghcr.io -u <github-username> --password-stdin
docker pull ghcr.io/codenteq/stream-platform-backend:latest
```

## Known limitations

- Destinations are added with an RTMP server URL and stream key. Signing in to a platform (OAuth) is not supported, so platform chat and comments are not shown in the studio.
- Recordings are made in the host's browser and downloaded there. There is no cloud recording.
- The show is composed in the host's browser. The host needs a reasonably fast computer and a stable uplink, around the chosen video bitrate plus headroom.

## License

[MIT](LICENSE)

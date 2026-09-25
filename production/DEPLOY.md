# Production Deployment Guide

This guide assumes you have a VPS with Docker and Docker Compose installed.

## Prerequisites
1.  **VPS**: Ubuntu 22.04/24.04 Recommended. (4 vCPU / 8GB RAM for stable Egress).
2.  **Domain**: `stream.codenteq.com` pointing to your VPS IP Address (A Record).
3.  **Ports**: Ensure ports 80, 443 (TCP) and 50400-50600 (UDP) are open on your firewall.

## Installation

1.  **Upload Files**: Copy the entire `production` folder to your VPS (e.g., to `/root/stream-platform`).
    Also copy the `backend` and `frontend` folders from your project to the VPS so the images can build (or setup a CI/CD to build images).
    *Simplest way*: Copy your entire project folder to the VPS.

2.  **Navigate to Production Directory**:
    ```bash
    cd production
    ```

3.  **Configure Environment**:
    Create `.env` from the example and replace every value:
    ```bash
    cp .env.example .env
    nano .env
    ```
    Pick a LiveKit API key and secret (`openssl rand -base64 32` generates a good secret) and put the same pair in `livekit.yaml` (`keys`) and `egress.yaml` (`api_key`, `api_secret`). Never deploy with the placeholder values.

3.1 **Cloudflare Configuration (Important)**:
    Since you are using Cloudflare, go to your Cloudflare Dashboard > SSL/TLS.
    Set the SSL/TLS encryption mode to **Flexible**.
    *Note: Caddy is configured to listen on HTTP (Port 80) to match this setting.*

4.  **Start Services**:
    ```bash
    docker-compose up -d --build
    ```

## Verification

1.  Go to `https://stream.codenteq.com`.
2.  The site should load with a valid SSL certificate (managed by Caddy).
3.  Try to log in and start a studio session.
4.  If video/audio doesn't work, check firewall settings for UDP ports 50400-50600.

## Troubleshooting

-   **Logs**: `docker-compose logs -f`
-   **LiveKit**: Check if browser console shows WebSocket connection errors.

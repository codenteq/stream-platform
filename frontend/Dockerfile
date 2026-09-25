# Build stage
FROM node:22-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Tarayıcıya gömülen adresler derleme anında belirlenir. Verilirse .env.production'daki
# değerleri ezer (.env.production.local önceliklidir); verilmezse .env.production kullanılır.
ARG NEXT_PUBLIC_LIVEKIT_WS_URL
ARG NEXT_PUBLIC_APP_URL
RUN if [ -n "$NEXT_PUBLIC_LIVEKIT_WS_URL" ]; then echo "NEXT_PUBLIC_LIVEKIT_WS_URL=$NEXT_PUBLIC_LIVEKIT_WS_URL" >> .env.production.local; fi \
 && if [ -n "$NEXT_PUBLIC_APP_URL" ]; then echo "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" >> .env.production.local; fi \
 && npm run build

# Final stage: only Next.js' standalone server with the dependencies it
# traced, plus static assets. No build cache or dev dependencies.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]

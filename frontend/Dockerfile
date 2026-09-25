# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Tarayıcıya gömülen adresler derleme anında belirlenir. Verilirse .env.production'daki
# değerleri ezer (.env.production.local önceliklidir); verilmezse .env.production kullanılır.
ARG NEXT_PUBLIC_LIVEKIT_WS_URL
ARG NEXT_PUBLIC_APP_URL
RUN if [ -n "$NEXT_PUBLIC_LIVEKIT_WS_URL" ]; then echo "NEXT_PUBLIC_LIVEKIT_WS_URL=$NEXT_PUBLIC_LIVEKIT_WS_URL" >> .env.production.local; fi \
 && if [ -n "$NEXT_PUBLIC_APP_URL" ]; then echo "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" >> .env.production.local; fi \
 && npm run build

# Final stage
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]

FROM golang:1.24.4 AS builder

WORKDIR /app

COPY . .

RUN go mod tidy
# -s -w drops debug symbols; the static binary needs nothing else at runtime.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /main ./cmd/api

# Final stage: plain Alpine instead of the Go toolchain image. It keeps a
# shell for the compose files that start the binary with `sh -c`.
FROM alpine:3.22

RUN adduser -D -H -u 10001 app

COPY --from=builder /main /main

USER app

EXPOSE 8000

CMD ["/main"]

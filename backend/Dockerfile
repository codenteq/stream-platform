FROM golang:1.24.4 AS builder

WORKDIR /app

COPY . .

RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /main ./cmd/api

# Final stage
FROM golang:1.24.4-alpine

WORKDIR /

COPY --from=builder /main /main

EXPOSE 8000

CMD ["/main"]
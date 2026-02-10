FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy discovery service
COPY services/discovery/ services/discovery/

WORKDIR /app/services/discovery

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /discoveryd ./cmd/discoveryd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /discoveryd /usr/local/bin/discoveryd

EXPOSE 8080

ENTRYPOINT ["discoveryd"]

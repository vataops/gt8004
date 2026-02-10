FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy gateway service
COPY services/gateway/ services/gateway/

WORKDIR /app/services/gateway

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /gatewayd ./cmd/gatewayd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /gatewayd /usr/local/bin/gatewayd

EXPOSE 8080

ENTRYPOINT ["gatewayd"]

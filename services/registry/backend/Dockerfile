FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy common module first for caching
COPY services/common/go/ services/common/go/

# Copy registry service
COPY services/registry/backend/ services/registry/backend/

WORKDIR /app/services/registry/backend

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /registryd ./cmd/registryd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /registryd /usr/local/bin/registryd

EXPOSE 8080 8081

ENTRYPOINT ["registryd"]

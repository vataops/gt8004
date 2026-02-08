FROM golang:1.24-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app

# Copy common/go (needed by replace directive in go.mod)
COPY common/go/ common/go/

# Copy backend source
COPY services/open/backend/ services/open/backend/

WORKDIR /app/services/open/backend
RUN go mod download
RUN CGO_ENABLED=0 go build -o /aesd ./cmd/aesd

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /aesd /usr/local/bin/aesd
EXPOSE 8080 8081
ENTRYPOINT ["aesd"]

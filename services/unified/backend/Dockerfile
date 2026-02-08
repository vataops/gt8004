FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy common module first for caching
COPY common/go/ common/go/

# Copy unified service
COPY services/unified/backend/ services/unified/backend/

WORKDIR /app/services/unified/backend

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /aesd ./cmd/aesd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /aesd /usr/local/bin/aesd

EXPOSE 8080 8081

ENTRYPOINT ["aesd"]

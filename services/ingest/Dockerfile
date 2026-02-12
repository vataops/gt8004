FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy ingest service
COPY services/ingest/ services/ingest/

WORKDIR /app/services/ingest

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /ingestd ./cmd/ingestd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /ingestd /usr/local/bin/ingestd

EXPOSE 9094

ENTRYPOINT ["ingestd"]

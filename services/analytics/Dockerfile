FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY services/analytics/ services/analytics/
WORKDIR /app/services/analytics
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /analyticsd ./cmd/analyticsd

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 1000 appuser
COPY --from=builder /analyticsd /usr/local/bin/analyticsd
USER appuser
EXPOSE 8080 8081
ENTRYPOINT ["analyticsd"]

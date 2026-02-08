FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy common module first for caching
COPY common/go/ common/go/

# Copy unified service
COPY services/unified/backend/ services/unified/backend/

WORKDIR /app/services/unified/backend

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /gt8004d ./cmd/gt8004d

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /gt8004d /usr/local/bin/gt8004d

EXPOSE 8080 8081

ENTRYPOINT ["gt8004d"]

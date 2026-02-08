FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /aesd ./cmd/aesd

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /aesd /usr/local/bin/aesd
EXPOSE 8080 8081
CMD ["aesd"]

FROM golang:1.24-alpine AS builder

WORKDIR /app

# Copy apigateway service
COPY services/apigateway/ services/apigateway/

WORKDIR /app/services/apigateway

RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o /apigatewayd ./cmd/apigatewayd

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /apigatewayd /usr/local/bin/apigatewayd

EXPOSE 8080

ENTRYPOINT ["apigatewayd"]

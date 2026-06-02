# syntax=docker/dockerfile:1

FROM golang:1.25.3-alpine AS builder

WORKDIR /src

COPY services/email-service/go.mod ./services/email-service/go.mod

WORKDIR /src/services/email-service
RUN go mod download

WORKDIR /src
COPY services/email-service ./services/email-service

WORKDIR /src/services/email-service
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/email-service .

FROM alpine:3.22 AS production

RUN apk add --no-cache ca-certificates wget && \
    addgroup -S app && \
    adduser -S -G app app

WORKDIR /app

COPY --from=builder /out/email-service ./email-service

USER app

ENV EMAIL_SERVICE_PORT=4004

EXPOSE 4004

CMD ["./email-service"]

# syntax=docker/dockerfile:1

FROM golang:1.25.3-alpine AS builder

WORKDIR /src

COPY go.mod ./
RUN go mod download

COPY . .

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

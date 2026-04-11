FROM golang:1.24-alpine AS builder
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Use alpine instead of scratch so cryptsetup/losetup/dmsetup are available
# for LUKS-encrypted workspace home dirs.
FROM alpine:3.19
RUN apk add --no-cache \
    ca-certificates \
    cryptsetup \
    e2fsprogs \
    util-linux \
    device-mapper
COPY --from=builder /app/server /server
ENTRYPOINT ["/server"]

# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM golang:1.25 AS build

WORKDIR /app

# Cache dependency downloads separately from source compilation.
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source and build a fully static binary.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/server ./cmd/api

# ── Stage 2: minimal runtime image ──────────────────────────────────────────
FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=build /app/server /app/server

# The service is configured entirely via environment variables in production.
# Optionally mount a YAML config file and point CONFIG_PATH at it.
EXPOSE 8080

ENTRYPOINT ["/app/server"]

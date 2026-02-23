#!/usr/bin/env bash
set -euo pipefail

LOCAL_PG_URL="postgresql://postgres:postgres@localhost:54322/cm_ed"
ENV_FILE=".env.local"

# ── Preflight ────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed. Install it from https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo "Error: Docker daemon is not running. Please start Docker and try again."
  exit 1
fi

# ── Start Postgres ───────────────────────────────────────────────────────────
echo "Starting local Postgres container..."
docker compose up -d postgres

echo "Waiting for Postgres to be ready..."
until docker compose exec -T postgres pg_isready -U postgres &>/dev/null; do
  sleep 1
done
echo "Postgres is ready."

# ── Configure .env.local ─────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE from .env.example..."
  cp .env.example "$ENV_FILE"
fi

# Set POSTGRES_URL if not already pointing at a real database
if grep -q '^POSTGRES_URL=\*\*\*\*' "$ENV_FILE" 2>/dev/null || \
   ! grep -q '^POSTGRES_URL=' "$ENV_FILE" 2>/dev/null; then
  if grep -q '^POSTGRES_URL=' "$ENV_FILE"; then
    # Replace the placeholder line
    sed -i.bak "s|^POSTGRES_URL=.*|POSTGRES_URL=$LOCAL_PG_URL|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
  else
    # Append if missing entirely
    echo "" >> "$ENV_FILE"
    echo "POSTGRES_URL=$LOCAL_PG_URL" >> "$ENV_FILE"
  fi
  echo "Set POSTGRES_URL in $ENV_FILE to local Postgres."
else
  echo "POSTGRES_URL already configured in $ENV_FILE — skipping."
fi

# ── Run migrations ───────────────────────────────────────────────────────────
echo "Running database migrations..."
pnpm db:migrate

echo ""
echo "Local database is ready!"
echo "  Connection: $LOCAL_PG_URL"
echo "  Studio:     pnpm db:studio"
echo "  Stop DB:    docker compose down"
echo "  Wipe DB:    docker compose down -v"

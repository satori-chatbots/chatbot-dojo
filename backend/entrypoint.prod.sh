#!/bin/sh
set -e

# Debug information
echo "DEBUG: Current user: $(whoami) ($(id))"
echo "DEBUG: Working directory: $(pwd)"
echo "DEBUG: /app permissions: $(ls -la /app/)"

# Ensure filevault and static directories exist with proper permissions
mkdir -p /app/filevault /app/static
chmod 755 /app/filevault /app/static

# Check if we can write to filevault
touch /app/filevault/test_write && rm /app/filevault/test_write && echo "DEBUG: Write test successful" || echo "DEBUG: Write test FAILED"

# Run Django management commands
uv run python manage.py migrate --noinput

# Collect static files (if needed)
uv run python manage.py collectstatic --noinput || true

# Create superuser from environment variables
uv run python manage.py ensure_superuser

# Ensure Senpai's embedding model is available without forcing a download on
# every container start. Preloaded images already have this cache populated.
SENPAI_EMBEDDING_MODEL_CACHE_ROOT="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT:-/opt/senpai-embedding-model-cache}"
if [ "${WARMUP_SENPAI_EMBEDDING_MODEL:-1}" = "0" ]; then
  echo "INFO: Skipping Senpai embedding model warmup because WARMUP_SENPAI_EMBEDDING_MODEL=0"
elif [ -d "$SENPAI_EMBEDDING_MODEL_CACHE_ROOT" ] && [ -n "$(find "$SENPAI_EMBEDDING_MODEL_CACHE_ROOT" -mindepth 1 -print -quit)" ]; then
  echo "INFO: Skipping Senpai embedding model warmup because cache already exists at $SENPAI_EMBEDDING_MODEL_CACHE_ROOT"
else
  uv run python manage.py warmup_senpai_embedding_model || echo "WARNING: Senpai embedding model warmup failed; continuing startup"
fi

# Start the application
uv run gunicorn senseiweb.wsgi:application --bind 0.0.0.0:8000

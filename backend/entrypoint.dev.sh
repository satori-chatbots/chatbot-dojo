#!/bin/sh
set -e

# Keep the mounted development virtualenv in sync with pyproject.toml/uv.lock.
# The named Docker volume can otherwise retain stale dependencies across rebuilds.
uv sync --locked

# Run Django management commands
/app/.venv/bin/python manage.py migrate

# Create superuser from environment variables
/app/.venv/bin/python manage.py ensure_superuser

# Optionally warm up Senpai's embedding model in development.
# Set WARMUP_SENPAI_EMBEDDING_MODEL=1 or true to enable it.
if [ "${WARMUP_SENPAI_EMBEDDING_MODEL:-0}" = "1" ] || \
  [ "${WARMUP_SENPAI_EMBEDDING_MODEL:-0}" = "true" ] || \
  [ "${WARMUP_SENPAI_EMBEDDING_MODEL:-0}" = "TRUE" ]; then
  /app/.venv/bin/python manage.py warmup_senpai_embedding_model || echo "WARNING: Senpai embedding model warmup failed; continuing startup"
else
  echo "INFO: Skipping Senpai embedding model warmup in development"
fi

# Start the development server
/app/.venv/bin/python manage.py runserver 0.0.0.0:8000

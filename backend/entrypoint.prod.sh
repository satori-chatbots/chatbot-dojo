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

# Start the application
uv run gunicorn senseiweb.wsgi:application --bind 0.0.0.0:8000

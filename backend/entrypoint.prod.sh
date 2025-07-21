#!/bin/sh
set -e

# Ensure filevault directory exists with proper permissions
mkdir -p /app/filevault
chmod 755 /app/filevault

# Run Django management commands
uv run python manage.py makemigrations --noinput
uv run python manage.py migrate --noinput

# Collect static files (if needed)
uv run python manage.py collectstatic --noinput || true

# Start the application
uv run gunicorn senseiweb.wsgi:application --bind 0.0.0.0:8000

#!/bin/sh
set -e

# Run Django management commands
uv run python manage.py migrate

# Create superuser from environment variables
uv run python manage.py ensure_superuser

# Start the development server
uv run python manage.py runserver 0.0.0.0:8000

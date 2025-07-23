#!/bin/sh
set -e

# Run Django management commands
uv run python manage.py migrate

# Start the development server
uv run python manage.py runserver 0.0.0.0:8000

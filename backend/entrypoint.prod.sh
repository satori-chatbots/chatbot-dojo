#!/bin/sh
set -e

uv run python manage.py makemigrations --noinput
uv run python manage.py migrate --noinput

# Start the server (adjust as needed)
uv run python manage.py runserver 0.0.0.0:8000

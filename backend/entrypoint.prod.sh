#!/bin/sh
set -e

uv run python manage.py makemigrations --noinput
uv run python manage.py migrate --noinput

uv run gunicorn senseiweb.wsgi:application --bind 0.0.0.0:8000

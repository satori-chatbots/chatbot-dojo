#!/bin/sh
set -e

# Run Django management commands
/app/.venv/bin/python manage.py migrate

# Create superuser from environment variables
/app/.venv/bin/python manage.py ensure_superuser

# Ensure Senpai's embedding model is downloaded before serving requests
/app/.venv/bin/python manage.py warmup_senpai_embedding_model

# Start the development server
/app/.venv/bin/python manage.py runserver 0.0.0.0:8000

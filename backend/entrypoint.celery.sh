#!/bin/sh
set -e

/app/.venv/bin/python manage.py warmup_senpai_embedding_model
/app/.venv/bin/celery -A senseiweb worker -l info

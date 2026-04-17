#!/bin/sh
set -e

/app/.venv/bin/celery -A senseiweb worker -l info

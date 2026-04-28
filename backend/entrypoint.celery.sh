#!/bin/sh
set -e

# Keep the mounted development virtualenv in sync with pyproject.toml/uv.lock.
# The named Docker volume can otherwise retain stale dependencies across rebuilds.
uv sync --locked

/app/.venv/bin/celery -A senseiweb worker -l info

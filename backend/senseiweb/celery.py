"""Celery configuration for the senseiweb project."""

import os

from celery import Celery, Task

# set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "senseiweb.settings")

app = Celery("senseiweb")

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self: Task) -> None:
    """A debug task that prints its own request information."""
    print(f"Request: {self.request!r}")

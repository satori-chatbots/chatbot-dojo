"""Celery task discovery shim for the tester app."""

from tester.api.tasks import execute_sensei_test_task, generate_profiles_task

__all__ = ["execute_sensei_test_task", "generate_profiles_task"]

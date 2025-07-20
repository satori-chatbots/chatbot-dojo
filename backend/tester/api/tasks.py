"""Celery tasks for the tester app."""

from celery import Task, shared_task

from .test_runner import TestExecutionConfig, TestRunner
from .tracer_generator import ProfileGenerationParams, TracerGenerator


@shared_task
def generate_profiles_task(task_id: int, params_dict: dict) -> None:
    """Celery task to generate TRACER profiles asynchronously."""
    params = ProfileGenerationParams(**params_dict)
    generator = TracerGenerator()
    generator.run_async_profile_generation(task_id, params)


@shared_task(bind=True)
def execute_sensei_test_task(self: Task, config_dict: dict) -> None:
    """Celery task to execute Sensei tests asynchronously with progress tracking."""
    config = TestExecutionConfig(**config_dict)
    test_runner = TestRunner()
    # Pass the Celery task instance for progress updates
    test_runner.execute_test_with_celery_progress(config, self)

"""Celery tasks for the tester app."""

from celery import shared_task

from .test_runner import TestExecutionConfig, TestRunner
from .tracer_generator import ProfileGenerationParams, TracerGenerator


@shared_task
def generate_profiles_task(task_id: int, params_dict: dict) -> None:
    """Celery task to generate TRACER profiles asynchronously."""
    params = ProfileGenerationParams(**params_dict)
    generator = TracerGenerator()
    generator.run_async_profile_generation(task_id, params)


@shared_task
def execute_sensei_test_task(config_dict: dict) -> None:
    """Celery task to execute Sensei tests asynchronously."""
    config = TestExecutionConfig(**config_dict)
    test_runner = TestRunner()
    test_runner.execute_test_background(config)

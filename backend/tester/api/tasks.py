"""Celery tasks for the tester app."""

from celery import shared_task

from .tracer_generator import ProfileGenerationParams, TracerGenerator


@shared_task
def generate_profiles_task(task_id: int, params_dict: dict) -> None:
    """Celery task to generate TRACER profiles asynchronously."""
    params = ProfileGenerationParams(**params_dict)
    generator = TracerGenerator()
    generator.run_async_profile_generation(task_id, params)

"""Profile generation functionality."""

import time
from typing import Any

from tester.api.base import logger
from tester.models import ProfileGenerationTask


class ProfileGenerator:
    """Handles user profile generation tasks."""

    def run_async_profile_generation(
        self,
        task_id: int,
        technology: str,
        conversations: int,
        turns: int,
        _user_id: Any,  # noqa: ANN401
    ) -> None:
        """Run profile generation asynchronously in a background thread."""
        task = None
        try:
            task = ProfileGenerationTask.objects.get(id=task_id)
            task.status = "RUNNING"
            task.stage = "Initializing"
            task.save()

            logger.info(f"Starting profile generation for task {task_id}")
            logger.info(f"Technology: {technology}, Conversations: {conversations}, Turns: {turns}")

            # Update progress
            task.progress_percentage = 10
            task.stage = "Setting up environment"
            task.save()

            # Detailed implementation would go here
            # This is a complex process for generating user profiles
            # For now, this is a placeholder that simulates the process

            # Simulate different stages of profile generation
            stages = [
                ("Analyzing conversation patterns", 20),
                ("Generating user personas", 40),
                ("Creating profile templates", 60),
                ("Validating profiles", 80),
                ("Finalizing generation", 100),
            ]

            for stage_name, progress in stages:
                task.stage = stage_name
                task.progress_percentage = progress
                task.save()

                # Simulate processing time
                time.sleep(2)

                # Check if task was cancelled
                task.refresh_from_db()
                if task.status == "CANCELLED":
                    logger.info(f"Profile generation task {task_id} was cancelled")
                    return

            task.status = "COMPLETED"
            task.progress_percentage = 100
            task.stage = "Completed"
            task.save()

            logger.info(f"Profile generation completed for task {task_id}")

        # Here it is helpful to catch everything
        except Exception as e:  # noqa: BLE001
            logger.error(f"Error in profile generation for task {task_id}: {e!s}")
            if task:
                try:
                    task.status = "FAILED"
                    task.error_message = str(e)
                    task.save()
                # Here too
                except Exception as update_exc:  # noqa: BLE001
                    logger.critical(
                        f"Failed to update task {task_id} to FAILED status after an error. "
                        f"Initial error: {e!s}. Update error: {update_exc!s}"
                    )

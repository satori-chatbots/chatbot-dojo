"""Tests for Celery task discovery."""

from django.test import SimpleTestCase

from tester.tasks import execute_sensei_test_task, generate_profiles_task


class CeleryTaskDiscoveryTests(SimpleTestCase):
    """Validate Celery autodiscovery imports the backend execution tasks."""

    def test_tester_tasks_imports_api_tasks_for_celery_autodiscovery(self) -> None:
        """Celery autodiscovery imports tester.tasks, which must expose backend execution tasks."""
        self.assertEqual(generate_profiles_task.name, "tester.api.tasks.generate_profiles_task")  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            execute_sensei_test_task.name,
            "tester.api.tasks.execute_sensei_test_task",
        )

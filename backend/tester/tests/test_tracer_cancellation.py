"""Tests for TRACER cancellation behavior."""

from unittest.mock import patch

from django.test import TestCase
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate

from tester.api.tracer_views import cancel_tracer_generation
from tester.models import ChatbotConnector, CustomUser, ProfileExecution, ProfileGenerationTask, Project


class TracerCancellationTests(TestCase):
    """Validate cancellation status transitions."""

    def setUp(self) -> None:
        """Create a user-owned TRACER execution."""
        self.user = CustomUser.objects.create_user(email="owner@example.com")
        connector = ChatbotConnector.objects.create(name="Connector", technology="custom", owner=self.user)
        self.project = Project.objects.create(name="Project", chatbot_connector=connector, owner=self.user)
        self.factory = APIRequestFactory()

    def _cancel(self, execution: ProfileExecution) -> Response:
        request = self.factory.post("/tracer/cancel/", {"execution_id": execution.id}, format="json")
        force_authenticate(request, user=self.user)
        return cancel_tracer_generation(request)

    @patch("tester.api.tracer_views.current_app.control.revoke")
    def test_cancel_without_process_marks_execution_cancelled(self, revoke_mock) -> None:  # noqa: ANN001
        """A queued or discarded task has no subprocess, so cancellation can complete immediately."""
        execution = ProfileExecution.objects.create(
            project=self.project,
            execution_name="TRACER_QUEUED",
            execution_type="tracer",
            status="RUNNING",
            profiles_directory="tracer_queued",
        )
        task = ProfileGenerationTask.objects.create(
            project=self.project,
            status="PENDING",
            execution=execution,
            celery_task_id="celery-task-id",
        )

        response = self._cancel(execution)

        self.assertEqual(response.status_code, 200)  # noqa: PT009
        revoke_mock.assert_called_once_with("celery-task-id", terminate=False)
        execution.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(execution.status, "CANCELLED")  # noqa: PT009
        self.assertIsNone(execution.process_id)  # noqa: PT009
        self.assertEqual(task.status, "CANCELLED")  # noqa: PT009

    @patch("tester.api.tracer_views.current_app.control.revoke")
    def test_cancel_with_process_keeps_cancelling_until_runner_terminates(self, revoke_mock) -> None:  # noqa: ANN001
        """A running subprocess should remain in CANCELLING while the generator terminates it."""
        execution = ProfileExecution.objects.create(
            project=self.project,
            execution_name="TRACER_RUNNING",
            execution_type="tracer",
            status="RUNNING",
            profiles_directory="tracer_running",
            process_id=12345,
        )
        task = ProfileGenerationTask.objects.create(
            project=self.project,
            status="RUNNING",
            execution=execution,
            celery_task_id="celery-task-id",
        )

        response = self._cancel(execution)

        self.assertEqual(response.status_code, 200)  # noqa: PT009
        revoke_mock.assert_called_once_with("celery-task-id", terminate=False)
        execution.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(execution.status, "CANCELLING")  # noqa: PT009
        self.assertEqual(execution.process_id, 12345)  # noqa: PT009
        self.assertEqual(task.status, "CANCELLING")  # noqa: PT009

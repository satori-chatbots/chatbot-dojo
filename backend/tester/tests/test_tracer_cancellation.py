"""Tests for TRACER cancellation behavior."""

from unittest.mock import Mock, patch

from django.test import TestCase
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate

from tester.api.tracer_views import (
    _build_tracer_execution_info,
    cancel_tracer_generation,
    check_tracer_generation_status,
)
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

    def _status(self, celery_task_id: str) -> Response:
        request = self.factory.get(f"/tracer/status/{celery_task_id}/")
        force_authenticate(request, user=self.user)
        return check_tracer_generation_status(request, celery_task_id)

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

    @patch("tester.api.tracer_views.AsyncResult")
    def test_status_uses_running_database_task_when_celery_reports_pending(self, async_result_mock: Mock) -> None:
        """A transient Celery PENDING state must not downgrade a running DB task."""
        async_result_mock.return_value = Mock(state="PENDING")
        execution = ProfileExecution.objects.create(
            project=self.project,
            execution_name="TRACER_RUNNING",
            execution_type="tracer",
            status="RUNNING",
            profiles_directory="tracer_running",
        )
        ProfileGenerationTask.objects.create(
            project=self.project,
            status="RUNNING",
            stage="Exploring: Session 1/2",
            progress_percentage=35,
            execution=execution,
            celery_task_id="celery-task-id",
        )

        response = self._status("celery-task-id")

        self.assertEqual(response.status_code, 200)  # noqa: PT009
        self.assertEqual(response.data["status"], "RUNNING")  # noqa: PT009
        self.assertEqual(response.data["stage"], "Exploring: Session 1/2")  # noqa: PT009
        self.assertEqual(response.data["progress"], 35)  # noqa: PT009

    @patch("tester.api.tracer_views.AsyncResult")
    def test_status_uses_success_database_task_when_celery_reports_pending(self, async_result_mock: Mock) -> None:
        """A transient Celery PENDING state must not downgrade a completed DB task."""
        async_result_mock.return_value = Mock(state="PENDING")
        execution = ProfileExecution.objects.create(
            project=self.project,
            execution_name="TRACER_SUCCESS",
            execution_type="tracer",
            status="SUCCESS",
            profiles_directory="tracer_success",
            generated_profiles_count=4,
        )
        ProfileGenerationTask.objects.create(
            project=self.project,
            status="SUCCESS",
            stage="COMPLETED",
            progress_percentage=100,
            execution=execution,
            celery_task_id="celery-task-id",
        )

        response = self._status("celery-task-id")

        self.assertEqual(response.status_code, 200)  # noqa: PT009
        self.assertEqual(response.data["status"], "SUCCESS")  # noqa: PT009
        self.assertEqual(response.data["progress"], 100)  # noqa: PT009
        self.assertEqual(response.data["generated_files"], 4)  # noqa: PT009

    def test_tracer_execution_list_item_includes_database_progress(self) -> None:
        """Silent dashboard refreshes need DB progress to avoid resetting the progress bar."""
        execution = ProfileExecution.objects.create(
            project=self.project,
            execution_name="TRACER_RUNNING",
            execution_type="tracer",
            status="RUNNING",
            profiles_directory="tracer_running",
        )
        ProfileGenerationTask.objects.create(
            project=self.project,
            status="RUNNING",
            stage="Exploring: Session 1/2",
            progress_percentage=35,
            execution=execution,
            celery_task_id="celery-task-id",
        )

        execution.refresh_from_db()
        execution_info = _build_tracer_execution_info(execution)

        self.assertEqual(execution_info["progress_stage"], "Exploring: Session 1/2")  # noqa: PT009
        self.assertEqual(execution_info["progress_percentage"], 35)  # noqa: PT009

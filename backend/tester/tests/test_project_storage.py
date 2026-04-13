"""Regression tests for project storage layout."""

import tempfile
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from tester.api.projects import ProjectViewSet
from tester.models import (
    ChatbotConnector,
    CustomUser,
    Project,
    TestFile,
    upload_to_execution,
)

HTTP_CREATED = 201


class ProjectStorageLayoutTests(TestCase):
    """Ensure project assets live under the user's lowercase projects directory."""

    def setUp(self) -> None:
        """Create a user, connector, and temporary media root."""
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        self.media_root = Path(temp_dir.name)

        override = override_settings(MEDIA_ROOT=self.media_root)
        override.enable()
        self.addCleanup(override.disable)

        self.user = CustomUser.objects.create_user(email="owner@example.com")
        self.connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        self.request_factory = APIRequestFactory()

    def test_user_creation_initializes_projects_directory(self) -> None:
        """Creating a user should also create the default projects directory."""
        expected_projects_dir = self.media_root / "projects" / f"user_{self.user.id}" / "projects"

        self.assertTrue(expected_projects_dir.exists())  # noqa: PT009
        self.assertTrue(expected_projects_dir.is_dir())  # noqa: PT009

    def test_project_creation_initializes_under_projects_folder(self) -> None:
        """New projects should be initialized inside the lowercase projects directory."""
        request = self.request_factory.post(
            "/api/projects/",
            {"name": "Alpha", "chatbot_connector": self.connector.id},
            format="json",
        )
        force_authenticate(request, user=self.user)

        with patch("tester.api.projects.init_proj") as init_proj_mock:
            response = ProjectViewSet.as_view({"post": "create"})(request)

        self.assertEqual(response.status_code, HTTP_CREATED)  # noqa: PT009

        project = Project.objects.get(name="Alpha")
        expected_parent = self.media_root / "projects" / f"user_{self.user.id}" / "projects"
        expected_project_dir = expected_parent / f"project_{project.id}"

        init_proj_mock.assert_called_once_with(project.get_project_folder_name(), str(expected_parent))
        self.assertEqual(Path(project.get_project_path()), expected_project_dir)  # noqa: PT009
        self.assertTrue((expected_project_dir / "run.yml").exists())  # noqa: PT009

    def test_execution_file_paths_include_projects_subdirectory(self) -> None:
        """Manual execution uploads should be stored under the lowercase projects directory."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)
        execution = project.create_manual_execution_folder()

        test_file = TestFile(project=project, execution=execution)
        expected_path = f"projects/user_{self.user.id}/projects/project_{project.id}/executions/manual_profiles/profiles/profile.yaml"

        self.assertEqual(upload_to_execution(test_file, "profile.yaml"), expected_path)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            execution.profiles_directory,
            f"projects/user_{self.user.id}/projects/project_{project.id}/executions/manual_profiles",
        )

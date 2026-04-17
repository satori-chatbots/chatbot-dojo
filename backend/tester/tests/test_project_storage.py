"""Regression tests for project storage layout."""

import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from tester.api.projects import ProjectViewSet
from tester.api.tracer_parser import TracerResultsProcessor
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
        with self.captureOnCommitCallbacks(execute=True):
            user = CustomUser.objects.create_user(email="new-owner@example.com")

        expected_projects_dir = self.media_root / "users" / f"user_{user.id}" / "projects"
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
        expected_parent = self.media_root / "users" / f"user_{self.user.id}" / "projects"
        expected_project_dir = expected_parent / f"project_{project.id}"

        init_proj_mock.assert_called_once_with(project.get_project_folder_name(), str(expected_parent))
        self.assertEqual(Path(project.get_project_path()), expected_project_dir)  # noqa: PT009
        self.assertTrue((expected_project_dir / "run.yml").exists())  # noqa: PT009

    def test_execution_file_paths_include_projects_subdirectory(self) -> None:
        """Profiles should be stored under the project profiles directory even when tied to an execution."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)
        execution = project.create_manual_execution_folder()

        test_file = TestFile(project=project, execution=execution)
        expected_path = f"users/user_{self.user.id}/projects/project_{project.id}/profiles/profile.yaml"

        self.assertEqual(upload_to_execution(test_file, "profile.yaml"), expected_path)  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            execution.profiles_directory,
            f"users/user_{self.user.id}/projects/project_{project.id}/executions/manual_profiles",
        )

    def test_test_file_save_keeps_manual_profiles_in_project_profiles_directory(self) -> None:
        """Manual profile uploads should end up in the canonical project profiles directory."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)
        execution = project.create_manual_execution_folder()
        profile = TestFile(project=project, execution=execution)
        profile.file.save(
            "upload.yaml",
            ContentFile("test_name: Manual Profile\nmessages: []\n"),
            save=False,
        )

        profile.save()

        expected_relative = f"users/user_{self.user.id}/projects/project_{project.id}/profiles/Manual Profile.yaml"
        self.assertEqual(profile.file.name, expected_relative)  # noqa: PT009
        self.assertTrue((self.media_root / expected_relative).exists())  # noqa: PT009

    def test_tracer_results_create_editable_profiles_in_project_profiles_directory(self) -> None:
        """TRACER-generated editable profiles should be stored where Senpai can index them."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)
        execution = project.profile_executions.create(
            execution_name="TRACER_1",
            execution_type="tracer",
            status="SUCCESS",
            profiles_directory=f"users/user_{self.user.id}/projects/project_{project.id}/tracer_results/tracer_1",
        )
        output_dir = self.media_root / execution.profiles_directory
        profiles_dir = output_dir / "profiles"
        profiles_dir.mkdir(parents=True, exist_ok=True)
        (profiles_dir / "generated.yaml").write_text("test_name: Generated Profile\nmessages: []\n", encoding="utf-8")

        TracerResultsProcessor().process_tracer_results_dual_storage(execution, output_dir)

        generated = TestFile.objects.get(project=project, execution=execution)
        expected_relative = f"users/user_{self.user.id}/projects/project_{project.id}/profiles/Generated Profile.yaml"
        self.assertEqual(generated.file.name, expected_relative)  # noqa: PT009
        self.assertTrue((self.media_root / expected_relative).exists())  # noqa: PT009

    def test_connector_creates_senpai_visible_yaml_mirror(self) -> None:
        """Every connector should have a YAML mirror under the user connectors directory."""
        connector = ChatbotConnector.objects.create(
            name="Webhook Connector",
            technology="rest",
            parameters={"url": "https://example.com/hook", "method": "POST"},
            owner=self.user,
        )

        mirror_path = (
            self.media_root / "users" / f"user_{self.user.id}" / "connectors" / f"connector_{connector.id}.yaml"
        )
        self.assertTrue(mirror_path.exists())  # noqa: PT009

        mirror_content = mirror_path.read_text(encoding="utf-8")
        self.assertTrue("name: Webhook Connector" in mirror_content)  # noqa: PT009
        self.assertTrue("technology: rest" in mirror_content)  # noqa: PT009
        self.assertTrue("url: https://example.com/hook" in mirror_content)  # noqa: PT009

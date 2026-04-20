"""Regression tests for project storage layout."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import yaml
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from tester.api.projects import ProjectViewSet
from tester.api.test_files import TestFileViewSet
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

    def test_profile_save_avoids_overwriting_existing_canonical_profile(self) -> None:
        """Saving a second profile with the same test_name should suffix the canonical filename."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)

        first_profile = TestFile(project=project)
        first_profile.file.save(
            "first-upload.yaml",
            ContentFile("test_name: Shared Name\nmessages:\n  - role: user\n    content: first\n"),
            save=False,
        )
        first_profile.save()

        second_profile = TestFile(project=project)
        second_profile.file.save(
            "second-upload.yaml",
            ContentFile("test_name: Shared Name\nmessages:\n  - role: user\n    content: second\n"),
            save=False,
        )
        second_profile.save()

        expected_primary = f"users/user_{self.user.id}/projects/project_{project.id}/profiles/Shared Name.yaml"
        expected_conflict = f"users/user_{self.user.id}/projects/project_{project.id}/profiles/Shared Name_1.yaml"

        self.assertEqual(first_profile.file.name, expected_primary)  # noqa: PT009
        self.assertEqual(second_profile.file.name, expected_conflict)  # noqa: PT009
        self.assertTrue((self.media_root / expected_primary).exists())  # noqa: PT009
        self.assertTrue((self.media_root / expected_conflict).exists())  # noqa: PT009
        self.assertTrue("content: first" in (self.media_root / expected_primary).read_text(encoding="utf-8"))  # noqa: PT009
        self.assertTrue("content: second" in (self.media_root / expected_conflict).read_text(encoding="utf-8"))  # noqa: PT009

    def test_bulk_test_file_creation_updates_manual_execution_count_once(self) -> None:
        """Bulk uploads should defer execution profile recounts until the batch is complete."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)
        execution = project.create_manual_execution_folder()
        request = self.request_factory.post(
            "/api/testfiles/upload/",
            {
                "project": str(project.id),
                "file": [
                    SimpleUploadedFile("first.yaml", b"test_name: First Profile\nmessages: []\n"),
                    SimpleUploadedFile("second.yaml", b"test_name: Second Profile\nmessages: []\n"),
                ],
            },
            format="multipart",
        )
        force_authenticate(request, user=self.user)

        with (
            patch.object(Project, "get_or_create_current_manual_execution", return_value=execution),
            patch.object(execution, "save", wraps=execution.save) as execution_save_spy,
        ):
            response = TestFileViewSet.as_view({"post": "upload"})(request)

        self.assertEqual(response.status_code, HTTP_CREATED)  # noqa: PT009
        self.assertEqual(len(response.data["uploaded_file_ids"]), 2)  # noqa: PT009
        execution_save_spy.assert_called_once_with(update_fields=["generated_profiles_count"])
        execution.refresh_from_db()
        self.assertEqual(execution.generated_profiles_count, 2)  # noqa: PT009

    def test_bulk_upload_preserves_conflict_resolved_name_from_processed_file_data(self) -> None:
        """Bulk uploads should keep the unique name chosen during conflict resolution."""
        project = Project.objects.create(name="Alpha", chatbot_connector=self.connector, owner=self.user)

        existing_profile = TestFile(project=project)
        existing_profile.file.save(
            "existing.yaml",
            ContentFile("test_name: Shared Name\nmessages:\n  - role: user\n    content: existing\n"),
            save=False,
        )
        existing_profile.save()

        request = self.request_factory.post(
            "/api/testfiles/upload/",
            {
                "project": str(project.id),
                "ignore_validation_errors": "true",
                "file": [
                    SimpleUploadedFile(
                        "duplicate.yaml",
                        b"test_name: Shared Name\nmessages:\n  - role: user\n    content: duplicate\n",
                    ),
                ],
            },
            format="multipart",
        )
        force_authenticate(request, user=self.user)

        response = TestFileViewSet.as_view({"post": "upload"})(request)

        self.assertEqual(response.status_code, HTTP_CREATED)  # noqa: PT009
        uploaded_profile = TestFile.objects.get(id=response.data["uploaded_file_ids"][0])
        expected_conflict = f"users/user_{self.user.id}/projects/project_{project.id}/profiles/Shared Name_1.yaml"

        self.assertEqual(uploaded_profile.name, "Shared Name_1")  # noqa: PT009
        self.assertEqual(uploaded_profile.file.name, expected_conflict)  # noqa: PT009
        self.assertFalse(uploaded_profile.is_valid)  # noqa: PT009
        self.assertTrue((self.media_root / expected_conflict).exists())  # noqa: PT009

    def test_connector_creates_senpai_visible_yaml_mirror(self) -> None:
        """Every connector should have a YAML mirror under the user connectors directory."""
        with self.captureOnCommitCallbacks(execute=True):
            connector = ChatbotConnector(
                name="Webhook Connector",
                technology="rest",
                parameters={
                    "url": "https://example.com/hook",
                    "method": "POST",
                    "api_key": "super-secret-token",
                    "nested": {"client_secret": "very-secret"},
                },
                owner=self.user,
            )
            connector.custom_config_file.save(
                "custom-connector.yaml",
                ContentFile("api_key: top-secret\nendpoint: https://example.com\n"),
                save=False,
            )
            connector.save()

        mirror_path = (
            self.media_root
            / "users"
            / f"user_{self.user.id}"
            / "connectors"
            / f"connector_{connector.id}__senpai_export.yaml"
        )
        self.assertTrue(mirror_path.exists())  # noqa: PT009

        mirror_payload = yaml.safe_load(mirror_path.read_text(encoding="utf-8"))
        self.assertEqual(mirror_payload["name"], "Webhook Connector")  # noqa: PT009
        self.assertEqual(mirror_payload["technology"], "rest")  # noqa: PT009
        self.assertEqual(mirror_payload["parameters"]["url"], "https://example.com/hook")  # noqa: PT009
        self.assertEqual(mirror_payload["parameters"]["api_key"], "***REDACTED***")  # noqa: PT009
        self.assertEqual(mirror_payload["parameters"]["nested"]["client_secret"], "***REDACTED***")  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            mirror_payload["custom_config_file"],
            f"users/user_{self.user.id}/connectors/custom-connector.yaml",
        )
        self.assertTrue("custom_config_content" not in mirror_payload)  # noqa: PT009

    def test_connector_export_does_not_collide_with_same_named_custom_config_file(self) -> None:
        """The Senpai export should not overwrite a custom connector file with the legacy export name."""
        with self.captureOnCommitCallbacks(execute=True):
            connector = ChatbotConnector.objects.create(
                name="Collision Safe Connector",
                technology="rest",
                parameters={"url": "https://example.com/collision", "method": "POST"},
                owner=self.user,
            )

        legacy_named_config = f"connector_{connector.id}.yaml"
        with self.captureOnCommitCallbacks(execute=True):
            connector.custom_config_file.save(
                legacy_named_config,
                ContentFile("endpoint: https://example.com/custom\n"),
                save=False,
            )
            connector.save()

        custom_config_path = self.media_root / "users" / f"user_{self.user.id}" / "connectors" / legacy_named_config
        export_path = (
            self.media_root
            / "users"
            / f"user_{self.user.id}"
            / "connectors"
            / f"connector_{connector.id}__senpai_export.yaml"
        )

        self.assertTrue(custom_config_path.exists())  # noqa: PT009
        self.assertTrue(export_path.exists())  # noqa: PT009
        self.assertEqual(  # noqa: PT009
            custom_config_path.read_text(encoding="utf-8"),
            "endpoint: https://example.com/custom\n",
        )

    def test_connector_rollback_does_not_create_senpai_yaml_mirror(self) -> None:
        """Connector export files should only be written after a successful commit."""
        rollback_error_message = "rollback"

        def raise_rollback() -> None:
            raise RuntimeError(rollback_error_message)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            try:
                with transaction.atomic():
                    connector = ChatbotConnector.objects.create(
                        name="Rolled Back Connector",
                        technology="rest",
                        parameters={"url": "https://example.com/rollback", "method": "POST"},
                        owner=self.user,
                    )
                    connector_id = connector.id
                    raise_rollback()
            except RuntimeError:
                pass

        mirror_path = (
            self.media_root
            / "users"
            / f"user_{self.user.id}"
            / "connectors"
            / f"connector_{connector_id}__senpai_export.yaml"
        )
        self.assertEqual(callbacks, [])  # noqa: PT009
        self.assertFalse(mirror_path.exists())  # noqa: PT009

"""Tests for Sensei execution configuration helpers."""

import tempfile
from pathlib import Path

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings

from tester.api.execution_utils import ExecutionUtils, RunYmlConfigParams
from tester.models import ChatbotConnector, CustomUser, Project
from tester.models import TestCase as SenseiTestCase


class ExecutionUtilsTests(TestCase):
    """Validate command configuration built for sensei-chat runs."""

    def setUp(self) -> None:
        """Create a temporary media root and common user."""
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        self.media_root = Path(temp_dir.name)

        override = override_settings(MEDIA_ROOT=self.media_root)
        override.enable()
        self.addCleanup(override.disable)

        self.user = CustomUser.objects.create_user(email="owner@example.com")

    def test_custom_connector_uses_config_file_path_as_connector_parameter(self) -> None:
        """Custom connectors should pass config_path to sensei-chat."""
        connector = ChatbotConnector.objects.create(
            name="Ada UAM",
            technology="custom",
            owner=self.user,
        )
        connector.custom_config_file.save(
            "ada-uam.yaml",
            ContentFile(
                'name: "Ada UAM"\n'
                'base_url: "https://api.1millionbot.com"\n'
                "send_message:\n"
                '  path: "/api/public/messages"\n'
                "  payload_template:\n"
                '    message: "{user_msg}"\n'
                'response_path: "response.0.text"\n',
            ),
        )
        project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=connector,
            owner=self.user,
        )
        test_case = SenseiTestCase.objects.create(project=project, status="SUCCESS")

        config = ExecutionUtils.build_run_yml_config(
            RunYmlConfigParams(
                project=project,
                test_case=test_case,
                results_path=str(self.media_root / "results"),
                technology="custom",
                user_simulator_dir=str(self.media_root),
            )
        )

        self.assertEqual(config["connector_parameters"], {"config_path": connector.custom_config_file.path})  # noqa: PT009

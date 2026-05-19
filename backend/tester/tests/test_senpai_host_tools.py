"""Tests for Chatbot Dojo tools exposed to Senpai Assistant."""

from django.test import TestCase
from langchain_core.tools import BaseTool

from tester.models import ChatbotConnector, CustomUser, ProfileExecution, Project
from tester.senpai_host_tools import build_chatbot_dojo_host_tools


class SenpaiHostToolsTests(TestCase):
    """Validate host-side tools that expose Chatbot Dojo runtime state."""

    def setUp(self) -> None:
        """Create visible and non-visible TRACER executions."""
        self.user = CustomUser.objects.create_user(email="owner@example.com")
        self.other_user = CustomUser.objects.create_user(email="other@example.com")
        self.connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        self.other_connector = ChatbotConnector.objects.create(
            name="Other Connector",
            technology="rasa",
            owner=self.other_user,
        )
        self.project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=self.connector,
            owner=self.user,
        )
        self.public_project = Project.objects.create(
            name="Public QA",
            chatbot_connector=self.other_connector,
            owner=self.other_user,
            public=True,
        )
        self.private_project = Project.objects.create(
            name="Private QA",
            chatbot_connector=self.other_connector,
            owner=self.other_user,
        )
        self._create_tracer_execution(self.project, "TRACER_CANCELLED", "CANCELLED")
        self._create_tracer_execution(self.project, "TRACER_SUCCESS", "SUCCESS")
        self._create_tracer_execution(self.public_project, "TRACER_PUBLIC_FAILURE", "FAILURE")
        self._create_tracer_execution(self.private_project, "TRACER_PRIVATE_CANCELLED", "CANCELLED")
        self._create_tracer_execution(self.project, "TRACER_RUNNING", "RUNNING")

        tools = build_chatbot_dojo_host_tools(self.user)
        self.tools = {tool.name: tool for tool in tools}

    def _create_tracer_execution(self, project: Project, name: str, status: str) -> ProfileExecution:
        return ProfileExecution.objects.create(
            project=project,
            execution_name=name,
            execution_type="tracer",
            status=status,
            profiles_directory=name.lower(),
        )

    def _tool(self, name: str) -> BaseTool:
        return self.tools[name]

    def test_tracer_summary_counts_visible_executions_only(self) -> None:
        """Summary should include owned and public runs but not another user's private runs."""
        result = self._tool("get_tracer_execution_summary").invoke({})

        self.assertEqual(result["total"], 4)  # noqa: PT009
        self.assertEqual(result["running"], 1)  # noqa: PT009
        self.assertEqual(result["cancelled"], 1)  # noqa: PT009
        self.assertEqual(result["successful"], 1)  # noqa: PT009
        self.assertEqual(result["failed"], 1)  # noqa: PT009
        self.assertTrue(result["has_active_process"])  # noqa: PT009
        self.assertEqual(result["active_execution_names"], ["TRACER_RUNNING"])  # noqa: PT009
        self.assertEqual(result["latest_execution"]["name"], "TRACER_RUNNING")  # noqa: PT009
        self.assertEqual(result["scope"]["visibility"], "current_user_and_public")  # noqa: PT009
        self.assertEqual(result["scope"]["project"], "all_visible")  # noqa: PT009

    def test_tracer_summary_can_filter_by_workspace_project_name(self) -> None:
        """Project filtering should accept the workspace name Senpai receives as active_project."""
        result = self._tool("get_tracer_execution_summary").invoke({"project": self.project.get_project_folder_name()})

        self.assertEqual(result["total"], 3)  # noqa: PT009
        self.assertEqual(result["cancelled"], 1)  # noqa: PT009
        self.assertEqual(result["failed"], 0)  # noqa: PT009
        self.assertEqual(result["scope"]["project"], self.project.name)  # noqa: PT009
        self.assertEqual(result["scope"]["project_id"], self.project.id)  # noqa: PT009

    def test_list_tracer_executions_filters_by_status_and_limit(self) -> None:
        """Listing should return a short recent list with optional status filtering."""
        result = self._tool("list_tracer_executions").invoke({"status": "cancelled", "limit": 5})

        self.assertEqual(result["count"], 1)  # noqa: PT009
        self.assertEqual(result["status_filter"], "CANCELLED")  # noqa: PT009
        self.assertEqual(result["executions"][0]["name"], "TRACER_CANCELLED")  # noqa: PT009
        self.assertEqual(result["executions"][0]["status"], "CANCELLED")  # noqa: PT009
        self.assertEqual(result["executions"][0]["project"], self.project.name)  # noqa: PT009

    def test_list_tracer_executions_rejects_invalid_status(self) -> None:
        """Invalid filters should return a tool-readable error instead of querying loosely."""
        result = self._tool("list_tracer_executions").invoke({"status": "BROKEN"})

        self.assertEqual(result, {"error": "Invalid TRACER status: BROKEN"})  # noqa: PT009

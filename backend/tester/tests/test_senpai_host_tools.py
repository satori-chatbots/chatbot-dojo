"""Tests for Chatbot Dojo tools exposed to Senpai Assistant."""

import tempfile
from pathlib import Path

from django.conf import settings
from django.test import TestCase, override_settings
from langchain_core.tools import BaseTool

from tester.models import ChatbotConnector, CustomUser, ProfileExecution, Project
from tester.models import TestCase as SenseiTestCase
from tester.senpai_host_tools import build_chatbot_dojo_host_tools


class SenpaiHostToolsTests(TestCase):
    """Validate host-side tools that expose Chatbot Dojo runtime state."""

    def setUp(self) -> None:
        """Create visible and non-visible TRACER executions."""
        self.media_root = tempfile.TemporaryDirectory(dir=settings.BASE_DIR)
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root.name)
        self.settings_override.enable()

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
        self._create_sensei_chat_execution(self.project, "Checkout Run", "SUCCESS")
        self._create_sensei_chat_execution(self.project, "Checkout Running", "RUNNING")
        self._create_sensei_chat_execution(self.public_project, "Public Failed Run", "FAILURE")
        self._create_sensei_chat_execution(self.private_project, "Private Running", "RUNNING")
        self._create_sensei_check_execution(self.project, "execution_20260520_101500", 0)
        self._create_sensei_check_execution(self.public_project, "execution_20260520_111500", 1)
        self._create_sensei_check_execution(self.private_project, "execution_20260520_121500", 0)

        tools = build_chatbot_dojo_host_tools(self.user)
        self.tools = {tool.name: tool for tool in tools}

    def _create_tracer_execution(self, project: Project, name: str, status: str) -> ProfileExecution:
        return ProfileExecution.objects.create(
            project=project,
            execution_name=name,
            execution_type="tracer",
            status=status,
            profiles_directory=name.lower(),
            tracer_stdout=f"{name} stdout line 1\n{name} stdout line 2",
            tracer_stderr=f"{name} stderr line 1\n{name} stderr line 2" if status == "FAILURE" else "",
            error_type="TRACER_ERROR" if status == "FAILURE" else "",
        )

    def _create_sensei_chat_execution(self, project: Project, name: str, status: str) -> SenseiTestCase:
        return SenseiTestCase.objects.create(
            project=project,
            name=name,
            status=status,
            technology=project.chatbot_connector.technology,
            total_conversations=3,
            executed_conversations=1 if status == "RUNNING" else 3,
            stdout="ok" if status == "SUCCESS" else "",
            stderr="failed" if status == "FAILURE" else "",
        )

    def _create_sensei_check_execution(self, project: Project, name: str, exit_code: int) -> Path:
        execution_dir = Path(project.get_project_path()) / "sensei_check_results" / name
        execution_dir.mkdir(parents=True, exist_ok=True)
        (execution_dir / "results.csv").write_text("rule,result\nexample,pass\n", encoding="utf-8")
        (execution_dir / "execution.log").write_text(
            f"Command: sensei-check\nExit Code: {exit_code}\n",
            encoding="utf-8",
        )
        return execution_dir

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

    def test_sensei_chat_summary_counts_visible_executions_only(self) -> None:
        """sensei-chat summary should include owned and public runs only."""
        result = self._tool("get_sensei_chat_execution_summary").invoke({})

        self.assertEqual(result["total"], 3)  # noqa: PT009
        self.assertEqual(result["running"], 1)  # noqa: PT009
        self.assertEqual(result["successful"], 1)  # noqa: PT009
        self.assertEqual(result["failed"], 1)  # noqa: PT009
        self.assertTrue(result["has_active_process"])  # noqa: PT009
        self.assertEqual(result["active_execution_names"], ["Checkout Running"])  # noqa: PT009
        self.assertEqual(result["scope"]["visibility"], "current_user_and_public")  # noqa: PT009

    def test_list_sensei_chat_executions_filters_by_status_and_project(self) -> None:
        """sensei-chat listing should filter by status and project."""
        result = self._tool("list_sensei_chat_executions").invoke(
            {"project": self.project.name, "status": "running", "limit": 5}
        )

        self.assertEqual(result["count"], 1)  # noqa: PT009
        self.assertEqual(result["status_filter"], "RUNNING")  # noqa: PT009
        self.assertEqual(result["executions"][0]["name"], "Checkout Running")  # noqa: PT009
        self.assertEqual(result["executions"][0]["project"], self.project.name)  # noqa: PT009

    def test_sensei_check_summary_reads_visible_execution_folders(self) -> None:
        """sensei-check summary should infer persisted runs from visible project folders."""
        result = self._tool("get_sensei_check_execution_summary").invoke({})

        self.assertEqual(result["total"], 2)  # noqa: PT009
        self.assertEqual(result["successful"], 1)  # noqa: PT009
        self.assertEqual(result["failed"], 1)  # noqa: PT009
        self.assertFalse(result["has_active_process"])  # noqa: PT009
        self.assertEqual(result["latest_execution"]["name"], "execution_20260520_111500")  # noqa: PT009

    def test_list_sensei_check_executions_returns_recent_files(self) -> None:
        """sensei-check listing should expose result and log paths for recent runs."""
        result = self._tool("list_sensei_check_executions").invoke({"project": self.project.name})

        self.assertEqual(result["count"], 1)  # noqa: PT009
        execution = result["executions"][0]
        self.assertEqual(execution["name"], "execution_20260520_101500")  # noqa: PT009
        self.assertEqual(execution["status"], "SUCCESS")  # noqa: PT009
        self.assertTrue(execution["has_results_csv"])  # noqa: PT009
        self.assertTrue(execution["log_file"].endswith("execution.log"))  # noqa: PT009

    def test_active_backend_executions_combines_tracer_and_sensei_chat(self) -> None:
        """The combined active tool should report running TRACER and sensei-chat executions."""
        result = self._tool("get_active_backend_executions").invoke({})

        self.assertTrue(result["has_active_process"])  # noqa: PT009
        self.assertEqual(result["tracer"]["count"], 1)  # noqa: PT009
        self.assertEqual(result["tracer"]["executions"][0]["name"], "TRACER_RUNNING")  # noqa: PT009
        self.assertEqual(result["sensei_chat"]["count"], 1)  # noqa: PT009
        self.assertEqual(result["sensei_chat"]["executions"][0]["name"], "Checkout Running")  # noqa: PT009
        self.assertEqual(result["sensei_check"]["count"], 0)  # noqa: PT009

    def test_analyze_dashboard_execution_results_returns_tracer_context(self) -> None:
        """Analysis tool should expose bounded TRACER execution artifacts."""
        execution = ProfileExecution.objects.get(execution_name="TRACER_PUBLIC_FAILURE")

        result = self._tool("analyze_dashboard_execution_results").invoke(
            {"dashboard": "tracer", "execution_id": execution.id, "log_tail_lines": 1}
        )

        self.assertEqual(result["dashboard"], "tracer")  # noqa: PT009
        self.assertEqual(result["execution"]["name"], "TRACER_PUBLIC_FAILURE")  # noqa: PT009
        self.assertEqual(result["error"]["error_type"], "TRACER_ERROR")  # noqa: PT009
        self.assertEqual(result["logs"]["stdout_tail"], "TRACER_PUBLIC_FAILURE stdout line 2")  # noqa: PT009
        self.assertEqual(result["logs"]["stderr_tail"], "TRACER_PUBLIC_FAILURE stderr line 2")  # noqa: PT009

    def test_analyze_dashboard_execution_results_returns_sensei_chat_context(self) -> None:
        """Analysis tool should expose sensei-chat progress and logs."""
        result = self._tool("analyze_dashboard_execution_results").invoke(
            {"dashboard": "sensei chat", "execution_name": "Public Failed Run"}
        )

        self.assertEqual(result["dashboard"], "sensei-chat")  # noqa: PT009
        self.assertEqual(result["execution"]["name"], "Public Failed Run")  # noqa: PT009
        self.assertEqual(result["progress"]["completion_percentage"], 100.0)  # noqa: PT009
        self.assertEqual(result["logs"]["stderr_tail"], "failed")  # noqa: PT009

    def test_analyze_dashboard_execution_results_returns_sensei_check_context(self) -> None:
        """Analysis tool should read persisted sensei-check CSV and log artifacts."""
        result = self._tool("analyze_dashboard_execution_results").invoke(
            {"dashboard": "sensei-check", "execution_name": "execution_20260520_101500"}
        )

        self.assertNotIn("error", result, result)  # noqa: PT009
        self.assertEqual(result["dashboard"], "sensei-check")  # noqa: PT009
        self.assertEqual(result["execution"]["name"], "execution_20260520_101500")  # noqa: PT009
        self.assertEqual(result["results"]["total_rows"], 1)  # noqa: PT009
        self.assertEqual(result["results"]["status_counts"], {"pass": 1})  # noqa: PT009
        self.assertIn("Exit Code: 0", result["logs"]["execution_log_tail"])  # noqa: PT009

    def test_analyze_dashboard_execution_results_rejects_invalid_dashboard(self) -> None:
        """Unknown dashboards should return a tool-readable error."""
        result = self._tool("analyze_dashboard_execution_results").invoke({"dashboard": "unknown"})

        self.assertEqual(result, {"error": "Invalid dashboard execution type: unknown"})  # noqa: PT009

    def tearDown(self) -> None:
        """Remove project folders created by sensei-check fixture data."""
        users_root = Path(settings.MEDIA_ROOT) / "users" / f"user_{self.user.id}"
        other_users_root = Path(settings.MEDIA_ROOT) / "users" / f"user_{self.other_user.id}"
        for root in (users_root, other_users_root):
            if root.exists():
                for execution_log in root.glob("**/sensei_check_results/**/execution.log"):
                    execution_log.unlink(missing_ok=True)
                for results_csv in root.glob("**/sensei_check_results/**/results.csv"):
                    results_csv.unlink(missing_ok=True)
        self.settings_override.disable()
        self.media_root.cleanup()

"""Regression tests for test error filtering endpoints."""

from django.test import TestCase
from rest_framework.test import APIClient

from tester.models import ChatbotConnector, CustomUser, GlobalReport, Project, TestError
from tester.models import TestCase as SenseiTestCase

HTTP_OK = 200
HTTP_BAD_REQUEST = 400


class TestErrorAPITests(TestCase):
    """Validate TestError filtering behavior."""

    def setUp(self) -> None:
        """Create a minimal project, test case, and global report."""
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(email="owner@example.com")
        self.connector = ChatbotConnector.objects.create(
            name="Primary Connector",
            technology="taskyto",
            owner=self.user,
        )
        self.project = Project.objects.create(
            name="Checkout QA",
            chatbot_connector=self.connector,
            owner=self.user,
        )
        self.test_case = SenseiTestCase.objects.create(project=self.project, status="SUCCESS")
        self.global_report = GlobalReport.objects.create(
            name="Global Report",
            test_case=self.test_case,
        )
        self.test_error = TestError.objects.create(
            code="AUTH_ERROR",
            count=1,
            global_report=self.global_report,
        )

    def test_global_report_id_filter_rejects_undefined(self) -> None:
        """Invalid JavaScript placeholder values should return 400, not a server error."""
        response = self.client.get("/api/testerrors/?global_report_id=undefined")

        self.assertEqual(response.status_code, HTTP_BAD_REQUEST)  # noqa: PT009
        self.assertEqual(response.data["invalid_values"], ["undefined"])  # noqa: PT009

    def test_global_report_id_filter_accepts_numeric_id(self) -> None:
        """Numeric report IDs should still filter test errors normally."""
        response = self.client.get(f"/api/testerrors/?global_report_id={self.global_report.id}")

        self.assertEqual(response.status_code, HTTP_OK)  # noqa: PT009
        self.assertEqual(len(response.data), 1)  # noqa: PT009
        self.assertEqual(response.data[0]["code"], self.test_error.code)  # noqa: PT009

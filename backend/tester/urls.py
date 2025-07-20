"""URLs for the sensei and tracer web app, defining API endpoints and custom routes."""

from django.urls import include, path
from rest_framework import routers

from . import api
from .api.base import get_all_providers, get_available_models

router = routers.DefaultRouter()
router.register(r"testcases", api.TestCaseViewSet, basename="testcase")
router.register(r"testfiles", api.TestFileViewSet, basename="testfile")
router.register(r"projects", api.ProjectViewSet, basename="project")
router.register(r"personalityfiles", api.PersonalityFileViewSet, basename="personalityfile")
router.register(r"rulefiles", api.RuleFileViewSet, basename="rulefile")
router.register(r"typefiles", api.TypeFileViewSet, basename="typefile")
router.register(r"projectconfigs", api.ProjectConfigViewSet, basename="projectconfig")
router.register(r"chatbotconnectors", api.ChatbotConnectorViewSet, basename="chatbotconnector")
router.register(r"globalreports", api.GlobalReportViewSet, basename="globalreport")
router.register(r"testerrors", api.TestErrorViewSet, basename="testerror")
router.register(r"profilereports", api.ProfileReportViewSet, basename="profilereport")
router.register(r"conversations", api.ConversationViewSet, basename="conversation")
router.register(r"register", api.RegisterViewSet, basename="register")
router.register(r"login", api.LoginViewSet, basename="login")
router.register(r"api-keys", api.UserAPIKeyViewSet, basename="api-key")


urlpatterns = [
    # Custom Routes First
    path(
        "execute-selected/",
        api.ExecuteSelectedProfilesAPIView.as_view(),
        name="execute-selected-profiles",
    ),
    path(
        "chatbotconnectors/choices/",
        api.get_technology_choices,
        name="chatbot-connectors-choices",
    ),
    path(
        "test-cases-stop/",
        api.stop_sensei_execution,
        name="stop-sensei-execution",
    ),
    path(
        "validate-token/",
        api.validate_token,
        name="validate-token",
    ),
    path(
        "update-profile/",
        api.UpdateProfileView.as_view(),
        name="update-profile",
    ),
    path(
        "testfiles/<int:file_id>/fetch/",
        api.fetch_file_content,
        name="fetch-file-content",
    ),
    path(
        "validate-yaml/",
        api.validate_yaml,
        name="validate-yaml",
    ),
    path(
        "generate-profiles/",
        api.generate_profiles,
        name="generate-profiles",
    ),
    path(
        "generation-status/<int:task_id>/",
        api.check_generation_status,
        name="check-generation-status",
    ),
    path(
        "sensei-execution-status/<str:task_id>/",
        api.check_sensei_execution_status,
        name="check-sensei-execution-status",
    ),
    path(
        "ongoing-generation/<int:project_id>/",
        api.check_ongoing_generation,
        name="check-ongoing-generation",
    ),
    path(
        "profile-executions/<int:project_id>/",
        api.get_profile_executions,
        name="get-profile-executions",
    ),
    path(
        "profile-execution/<int:execution_id>/delete/",
        api.delete_profile_execution,
        name="delete-profile-execution",
    ),
    path(
        "tracer-executions/",
        api.get_tracer_executions,
        name="get-tracer-executions",
    ),
    path(
        "tracer-analysis-report/<int:execution_id>/",
        api.get_tracer_analysis_report,
        name="get-tracer-analysis-report",
    ),
    path(
        "tracer-workflow-graph/<int:execution_id>/",
        api.get_tracer_workflow_graph,
        name="get-tracer-workflow-graph",
    ),
    path(
        "tracer-original-profiles/<int:execution_id>/",
        api.get_tracer_original_profiles,
        name="get-tracer-original-profiles",
    ),
    path(
        "tracer-execution-logs/<int:execution_id>/",
        api.get_tracer_execution_logs,
        name="get-tracer-execution-logs",
    ),
    path(
        "llm-models/",
        get_available_models,
        name="llm-models",
    ),
    path(
        "llm-providers/",
        get_all_providers,
        name="llm-providers",
    ),
    # Then Include Router URLs
    path("", include(router.urls)),
]

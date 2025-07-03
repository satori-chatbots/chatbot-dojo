"""API module for tester app.

This package provides API views and viewsets for authentication, project management,
test execution, reporting, and related functionalities in the tester application.
"""

# Import all ViewSets and API views from split modules
from .auth import (
    LoginViewSet,
    RegisterViewSet,
    UpdateProfileView,
    UserAPIKeyViewSet,
    validate_token,
)
from .connectors import ChatbotConnectorViewSet, get_technology_choices
from .conversations import ConversationViewSet
from .errors import TestErrorViewSet
from .execution_views import (
    ExecuteSelectedAPIView,
    check_generation_status,
    check_ongoing_generation,
    delete_profile_execution,
    generate_profiles,
    get_profile_executions,
    get_tracer_analysis_report,
    get_tracer_executions,
    get_tracer_execution_logs,
    get_tracer_original_profiles,
    get_tracer_workflow_graph,
    stop_test_execution,
)
from .project_files import (
    PersonalityFileViewSet,
    ProjectConfigViewSet,
    RuleFileViewSet,
    TypeFileViewSet,
)
from .projects import ProjectViewSet, fetch_file_content, validate_yaml
from .reports import GlobalReportViewSet, ProfileReportViewSet
from .test_cases import TestCaseViewSet
from .test_files import TestFileViewSet

__all__ = [
    "ChatbotConnectorViewSet",
    "ConversationViewSet",
    "ExecuteSelectedAPIView",
    "GlobalReportViewSet",
    "LoginViewSet",
    "PersonalityFileViewSet",
    "ProfileReportViewSet",
    "ProjectConfigViewSet",
    "ProjectViewSet",
    "RegisterViewSet",
    "RuleFileViewSet",
    "TestCaseViewSet",
    "TestErrorViewSet",
    "TestFileViewSet",
    "TypeFileViewSet",
    "UpdateProfileView",
    "UserAPIKeyViewSet",
    "check_generation_status",
    "check_ongoing_generation",
    "delete_profile_execution",
    "fetch_file_content",
    "generate_profiles",
    "get_profile_executions",
    "get_technology_choices",
    "get_tracer_analysis_report",
    "get_tracer_executions",
    "get_tracer_execution_logs",
    "get_tracer_original_profiles",
    "get_tracer_workflow_graph",
    "stop_test_execution",
    "validate_token",
    "validate_yaml",
]

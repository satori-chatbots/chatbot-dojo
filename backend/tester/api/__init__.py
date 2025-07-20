"""API module for tester app.

This package provides API views and viewsets for authentication, project management,
TRACER profile generation, Sensei profile execution, reporting, and related functionalities.
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
from .project_files import (
    PersonalityFileViewSet,
    ProjectConfigViewSet,
    RuleFileViewSet,
    TypeFileViewSet,
)
from .projects import ProjectViewSet, fetch_file_content, validate_yaml
from .reports import GlobalReportViewSet, ProfileReportViewSet
from .sensei_execution_views import (
    ExecuteSelectedProfilesAPIView,
    check_sensei_execution_status,
    delete_profile_execution,
    get_profile_executions,
    stop_sensei_execution,
)
from .test_cases import TestCaseViewSet
from .test_files import TestFileViewSet
from .tracer_views import (
    check_ongoing_generation,
    check_tracer_generation_status,
    generate_profiles,
    get_tracer_analysis_report,
    get_tracer_execution_logs,
    get_tracer_executions,
    get_tracer_original_profiles,
    get_tracer_workflow_graph,
)

__all__ = [
    "ChatbotConnectorViewSet",
    "ConversationViewSet",
    "ExecuteSelectedProfilesAPIView",
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
    "check_ongoing_generation",
    "check_sensei_execution_status",
    "check_tracer_generation_status",
    "delete_profile_execution",
    "fetch_file_content",
    "generate_profiles",
    "get_profile_executions",
    "get_technology_choices",
    "get_tracer_analysis_report",
    "get_tracer_execution_logs",
    "get_tracer_executions",
    "get_tracer_original_profiles",
    "get_tracer_workflow_graph",
    "stop_sensei_execution",
    "validate_token",
    "validate_yaml",
]

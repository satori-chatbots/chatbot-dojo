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
from .conversations import ConversationViewSet
from .errors import TestErrorViewSet
from .execution_views import (
    ExecuteSelectedAPIView,
    check_generation_status,
    check_ongoing_generation,
    generate_profiles,
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
from .technologies import ChatbotTechnologyViewSet, get_technology_choices
from .test_cases import TestCaseViewSet
from .test_files import TestFileViewSet

__all__ = [
    "ChatbotTechnologyViewSet",
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
    "fetch_file_content",
    "generate_profiles",
    "get_technology_choices",
    "stop_test_execution",
    "validate_token",
    "validate_yaml",
]

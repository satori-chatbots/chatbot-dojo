# API module for tester app

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
    stop_test_execution,
    check_generation_status,
    check_ongoing_generation,
    generate_profiles,
)
from .projects import ProjectViewSet, fetch_file_content, validate_yaml
from .project_files import (
    PersonalityFileViewSet,
    RuleFileViewSet,
    TypeFileViewSet,
    ProjectConfigViewSet,
)
from .reports import GlobalReportViewSet, ProfileReportViewSet
from .technologies import ChatbotTechnologyViewSet, get_technology_choices
from .test_cases import TestCaseViewSet
from .test_files import TestFileViewSet

__all__ = [
    # Auth
    "LoginViewSet",
    "UpdateProfileView",
    "validate_token",
    "RegisterViewSet",
    "UserAPIKeyViewSet",
    # Conversations
    "ConversationViewSet",
    # Errors
    "TestErrorViewSet",
    # Reports
    "ProfileReportViewSet",
    "GlobalReportViewSet",
    # Technologies
    "get_technology_choices",
    "ChatbotTechnologyViewSet",
    # Test Cases
    "TestCaseViewSet",
    # Projects
    "ProjectViewSet",
    "validate_yaml",
    "fetch_file_content",
    # Project Files
    "PersonalityFileViewSet",
    "RuleFileViewSet",
    "TypeFileViewSet",
    "ProjectConfigViewSet",
    # Test Files
    "TestFileViewSet",
    # Execution
    "ExecuteSelectedAPIView",
    "generate_profiles",
    "check_generation_status",
    "check_ongoing_generation",
    "stop_test_execution",
]

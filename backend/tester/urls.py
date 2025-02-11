from rest_framework import routers
from django.urls import include, path
from . import views
from . import api


# urlpatterns = router.urls
router = routers.DefaultRouter()
router.register(r"testcases", api.TestCaseViewSet, basename="testcase")
router.register(r"testfiles", api.TestFileViewSet, basename="testfile")
router.register(r"projects", api.ProjectViewSet, basename="project")
router.register(
    r"chatbottechnologies", api.ChatbotTechnologyViewSet, basename="chatbottechnology"
)
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
        api.ExecuteSelectedAPIView.as_view(),
        name="execute-selected",
    ),
    path(
        "chatbottechnologies/choices/",
        api.get_technology_choices,
        name="chatbot-technologies-choices",
    ),
    path(
        "test-cases-stop/",
        api.stop_test_execution,
        name="stop-test-execution",
    ),
    path(
        "validate-token/",
        api.validate_token,
        name="validate-token",
    ),
    # Then Include Router URLs
    path("", include(router.urls)),
]

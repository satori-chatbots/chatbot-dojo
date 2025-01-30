from rest_framework import routers
from django.urls import include, path
from . import views
from . import api


# urlpatterns = router.urls
router = routers.DefaultRouter()
router.register(r"testcases", api.TestCaseViewSet)
router.register(r"testfiles", api.TestFileViewSet)
router.register(r"projects", api.ProjectViewSet)
router.register(r"chatbottechnologies", api.ChatbotTechnologyViewSet)
router.register(r"globalreports", api.GlobalReportViewSet)
router.register(r"testerrors", api.TestErrorViewSet)
router.register(r"testreports", api.TestReportViewSet)

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
    # Then Include Router URLs
    path("", include(router.urls)),
]

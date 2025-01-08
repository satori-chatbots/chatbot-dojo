from rest_framework import routers
from django.urls import include, path
from . import views
from . import api


# urlpatterns = router.urls
router = routers.DefaultRouter()
router.register(r'testcases', api.TestCaseViewSet)
router.register(r'testfiles', api.TestFileViewSet)

urlpatterns = [
    # Custom Routes First
    path('execute-selected/', api.ExecuteSelectedAPIView.as_view(), name='execute-selected'),

    # Then Include Router URLs
    path('', include(router.urls)),
]

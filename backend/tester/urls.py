from rest_framework import routers
from django.urls import include, path
from . import views
from . import api


# urlpatterns = router.urls
router = routers.DefaultRouter()
router.register(r'testcases', api.TestCaseViewSet)
router.register(r'testfiles', api.TestFileViewSet)

urlpatterns = [
    path('', include(router.urls)),
]

urlpatterns += [
    path('upload/', api.FileUploadAPIView.as_view(), name='file-upload'),
    path('testfiles/delete/', api.FileDeleteAPIView.as_view(), name='file-delete-bulk'),
    path('testfiles/delete/<int:id>/', api.FileDeleteAPIView.as_view(), name='file-delete-single'),
]

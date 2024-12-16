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
# urlpatterns = [
#     path('upload/', views.UploadAPIView.as_view(), name='upload'),
#     path('execute/', views.ExecuteAPIView.as_view(), name='execute'),
#     path('results/<int:pk>/', views.show_results, name='results'),
# ]

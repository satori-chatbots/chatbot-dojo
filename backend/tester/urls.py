from rest_framework import routers
from django.urls import path
from . import views
from . import api

router = routers.DefaultRouter()

router.register('api/testcase', api.TestCaseViewSet, 'testcase')

# urlpatterns = router.urls

urlpatterns = [
    path('upload/', views.UploadAPIView.as_view(), name='upload'),
    path('execute/', views.ExecuteAPIView.as_view(), name='execute'),
    path('results/<int:pk>/', views.show_results, name='results'),
]

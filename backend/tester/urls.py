from rest_framework import routers
from django.urls import path
from . import views
from . import api

router = routers.DefaultRouter()

router.register('api/testcase', api.TestCaseViewSet, 'testcase')

urlpatterns = router.urls

urlpatterns += [
    path('', views.upload_file, name='upload'),
    path('results/<int:pk>/', views.show_results, name='results'),
]

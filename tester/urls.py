from django.urls import path
from . import views

urlpatterns = [
    path('', views.upload_file, name='upload'),
    path('results/<int:pk>/', views.show_results, name='results'),
]

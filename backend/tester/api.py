from .models import TestCase, TestFile
from .serializers import TestCaseSerializer, TestFileSerializer
from rest_framework import viewsets, permissions

class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = TestCaseSerializer

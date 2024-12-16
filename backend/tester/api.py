from rest_framework import viewsets
from .models import TestCase, TestFile
from .serializers import TestCaseSerializer, TestFileSerializer

class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer

class TestFileViewSet(viewsets.ModelViewSet):
    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer

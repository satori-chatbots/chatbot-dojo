from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import TestCase, TestFile
from .serializers import TestCaseSerializer, TestFileSerializer

class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer

class TestFileViewSet(viewsets.ModelViewSet):
    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer

class FileUploadAPIView(APIView):
    """
    API endpoint that allows multiple files to be uploaded.
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, format=None):
        files = request.FILES.getlist('file')
        if not files:
            return Response({'error': 'No files provided.'}, status=status.HTTP_400_BAD_REQUEST)

        file_instances = []
        for f in files:
            file_instance = TestFile(file=f)
            file_instance.save()
            file_instances.append(file_instance)

        serializer = TestFileSerializer(file_instances, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
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

    # Allow bulk deletion of files without creating a new view
    @action(detail=False, methods=['delete'], url_path='delete-bulk')
    def bulk_delete(self, request):
        """
        Endpoint for bulk deleting files.
        Expects a JSON body with a list of file IDs:
        {
            "ids": [1, 2, 3]
        }
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)

        files = TestFile.objects.filter(id__in=ids)
        if not files.exists():
            return Response({'error': 'No files found for the provided IDs.'}, status=status.HTTP_404_NOT_FOUND)

        deleted_count, _ = files.delete()
        return Response({'deleted': deleted_count}, status=status.HTTP_200_OK)

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

import subprocess
import time
import configparser
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.conf import settings
from .models import TestCase, TestFile
from .serializers import TestCaseSerializer, TestFileSerializer
import os
from .utils import check_keys

class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer

class TestFileViewSet(viewsets.ModelViewSet):
    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer

    # Own implementation because now if we delete a file, the row in the DB still exists
    def list(self, request, *args, **kwargs):
        """Return a list of all the YAML files uploaded, if one is missing, delete the row in the DB.
        If a new file is found in the directory, add it to the DB.

        Args:
            request (Request): The request object.

        Returns:
            Response: Serialized data of the files.
        """
        queryset = self.filter_queryset(self.get_queryset())

        # Check if a file is missing, if so, delete the row in the DB
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        # Check for new files in the directory and add them to the DB
        directory_path = os.path.join(settings.MEDIA_ROOT, 'user-yaml')
        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            if not queryset.filter(file__icontains=filename).exists():
                new_file = TestFile(file=file_path)
                new_file.save()


        # Repeat the query after possible deletions
        queryset = self.filter_queryset(self.get_queryset())

        # Paginate the queryset if needed
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # Allow bulk deletion of files without creating a new view
    @action(detail=False, methods=['delete'], url_path='delete-bulk')
    def bulk_delete(self, request):
        """
        Endpoint for bulk deleting files.
        Expects a JSON body with a list of file IDs:
        {
            "ids": [1, 2, 3]
        }

        Args:
            request (Request): The request object.

        Returns:
            Response: Response with the number of files deleted or an error message.
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)

        files = TestFile.objects.filter(id__in=ids)
        if not files.exists():
            return Response({'error': 'No files found for the provided IDs.'}, status=status.HTTP_404_NOT_FOUND)

        for file in files:
            file.delete()

        return Response({'deleted': len(ids)}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='upload', parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """
        Endpoint to upload multiple files.
        Expects multipart/form-data with files under the key 'file':
        {
            "file": [file1, file2, ...]
        }

        Args:
            request (Request): The request object.

        Returns:
            Response: If successful, returns the serialized data of the uploaded files.
        """
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

class ExecuteAllAPIView(APIView):

    def post(self, request, format=None):
        """
        Execute all test files in the user-yaml directory using Taskyto.
        """
        uploads_dir = os.path.join(settings.MEDIA_ROOT, 'user-yaml')
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)
            return Response(
                {'error': 'Uploads directory did not exist and has been created. Please add files and try again.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        test_files = TestFile.objects.all()
        if not test_files.exists():
            return Response(
                {'error': 'No test files available to execute.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        results = []
        # Go up one more because if not we are in backend dir and not in the project dir
        base_dir = os.path.dirname(settings.BASE_DIR)
        script_path = os.path.join(base_dir, 'user-simulator', 'src', 'autotest.py')

        # Load OPENAI_API_KEY from keys.properties
        check_keys(["OPENAI_API_KEY"])

        # Set extract dir to MEDIA / results
        extract_dir = os.path.join(settings.MEDIA_ROOT, 'results')

        # Set CWD to the script dir
        print(f"Script path: {script_path}")
        cwd = os.chdir(os.path.dirname(os.path.dirname(script_path)))
        print(f"CWD: {cwd}")


        for test_file in test_files:
            file_path = test_file.file.path
            extract_dir = os.path.dirname(file_path)
            try:
                start_time = time.time()
                result = subprocess.run(
                    ['python', script_path,
                     '--technology', 'taskyto',
                     '--chatbot', 'http://127.0.0.1:5000',
                     '--user', file_path,
                     '--extract', extract_dir],
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                )
                end_time = time.time()
                elapsed_time = round(end_time - start_time, 2)

                test_file.result = result.stdout.strip() or result.stderr.strip()
                test_file.execution_time = elapsed_time
                test_file.save()

                results.append({
                    'file_id': test_file.id,
                    'file_name': os.path.basename(file_path),
                    'execution_time': elapsed_time,
                    'result': test_file.result
                })

            except Exception as e:
                test_file.result = f"Error: {e}"
                test_file.execution_time = 0
                test_file.save()
                results.append({
                    'file_id': test_file.id,
                    'file_name': os.path.basename(file_path),
                    'error': str(e)
                })

        return Response({'results': results}, status=status.HTTP_200_OK)

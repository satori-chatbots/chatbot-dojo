from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from .serializers import TestFileSerializer
from .forms import TestCaseForm, TestFileForm
from .models import TestCase, TestFile
from django.shortcuts import render, get_object_or_404
import os
import subprocess
import time


class ExecuteAPIView(APIView):
    def post(self, request, format=None):
        test_case_id = request.data.get("test_case_id")
        test_case_instance = get_object_or_404(TestCase, id=test_case_id)
        files = TestFile.objects.filter(test_case=test_case_instance)
        if not files.exists():
            return Response(
                {"error": "No files associated with this test case"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_path = os.path.dirname(files.first().file.path)
        base_dir = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        extract_dir = os.path.dirname(file_path)
        script_path = os.path.join(base_dir, "user-simulator/src/autotest.py")
        os.chdir(os.path.dirname(os.path.dirname(script_path)))
        try:
            start_time = time.time()
            result = subprocess.run(
                [
                    "python",
                    script_path,
                    "--technology",
                    "taskyto",
                    "--chatbot",
                    "http://127.0.0.1:5000",
                    "--user",
                    file_path,
                    "--extract",
                    extract_dir,
                ],
                capture_output=True,
                text=True,
            )
            end_time = time.time()
            elapsed_time = end_time - start_time
            test_case_instance.execution_time = round(elapsed_time, 2)
            test_case_instance.result = result.stdout
            test_case_instance.save()
            return Response(
                {"result": test_case_instance.result}, status=status.HTTP_200_OK
            )
        except Exception as e:
            test_case_instance.result = f"Error: {e}"
            test_case_instance.save()
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def show_results(request, pk):
    test_case = get_object_or_404(TestCase, pk=pk)
    execution_time = test_case.execution_time
    hours = int(execution_time // 3600)
    minutes = int(execution_time // 60 % 60)
    seconds = round(execution_time % 60, 2)
    if hours > 0:
        formatted_time = f"{hours} hours, {minutes} minutes and {seconds} seconds"
    elif minutes > 0:
        formatted_time = f"{minutes} minutes and {seconds} seconds"
    else:
        formatted_time = f"{seconds} seconds"
    return render(
        request,
        "results.html",
        {"test_case": test_case, "formatted_time": formatted_time},
    )

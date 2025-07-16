"""Views for executing sensei test cases and displaying results."""

import shutil
import subprocess
import sys
import time
from pathlib import Path

from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, render
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TestCase, TestFile


class ExecuteAPIView(APIView):
    """API view to execute a test case using the user-simulator script."""

    def post(self, request: Request) -> Response:
        """Execute the test case and return the result."""
        test_case_id = request.data.get("test_case_id")
        test_case_instance = get_object_or_404(TestCase, id=test_case_id)
        files = TestFile.objects.filter(test_case=test_case_instance)
        if not files.exists():
            return Response(
                {"error": "No files associated with this test case"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_path = Path(files.first().file.path).parent
        base_dir = Path(__file__).resolve().parents[3]
        extract_dir = file_path.parent
        script_path = base_dir / "user-simulator" / "src" / "user_sim" / "cli" / "sensei_chat.py"
        work_dir = script_path.parent.parent
        python_executable = sys.executable or shutil.which("python3") or shutil.which("python")
        if not python_executable:
            return Response({"error": "Python executable not found."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        command = [
            python_executable,
            str(script_path),
            "--technology",
            "taskyto",
            "--chatbot",
            "http://127.0.0.1:5000",
            "--user",
            str(file_path),
            "--extract",
            str(extract_dir),
        ]
        # Basic validation: ensure no argument contains shell metacharacters
        if not all(isinstance(arg, str) and all(c.isalnum() or c in "-_.:/" for c in arg) for arg in command):
            return Response({"error": "Unsafe command arguments detected."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            start_time = time.time()
            result = subprocess.run(  # noqa: S603
                command,
                check=False,
                capture_output=True,
                text=True,
                cwd=str(work_dir),
            )
            end_time = time.time()
            elapsed_time = end_time - start_time
            test_case_instance.execution_time = round(elapsed_time, 2)
            test_case_instance.result = result.stdout
            test_case_instance.save()
            return Response({"result": test_case_instance.result}, status=status.HTTP_200_OK)
        except subprocess.SubprocessError as e:
            test_case_instance.result = f"Error: {e}"
            test_case_instance.save()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def show_results(request: HttpRequest, pk: int) -> HttpResponse:
    """Render the results page for a given test case."""
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

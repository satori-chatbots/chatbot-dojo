import shutil
import subprocess
import time
import configparser
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.conf import settings
from .models import (
    ChatbotTechnology,
    Conversation,
    GlobalReport,
    ProfileReport,
    TestCase,
    TestError,
    TestFile,
    Project,
    ProfileReport,
)
from .serializers import (
    ChatbotTechnologySerializer,
    ConversationSerializer,
    GlobalReportSerializer,
    TestCaseSerializer,
    TestFileSerializer,
    ProjectSerializer,
    TestErrorSerializer,
    ProfileReportSerializer,
)
from django.http import JsonResponse
from .models import TECHNOLOGY_CHOICES
import os
from .utils import check_keys
import yaml
from django.shortcuts import get_object_or_404
from django.db import transaction
import threading

# --------------------- #
# - CONVERSATIONS API - #
# --------------------- #


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer

    def list(self, request, *args, **kwargs):
        profile_report_ids = request.query_params.get("profile_report_ids", None)
        profile_report_id = request.query_params.get("profile_report_id", None)

        if profile_report_ids is not None:
            profile_reports = ProfileReport.objects.filter(
                id__in=profile_report_ids.split(",")
            )
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report__in=profile_reports
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif profile_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report=profile_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ------------------- #
# - TEST ERRORS API - #
# ------------------- #


class TestErrorViewSet(viewsets.ModelViewSet):
    queryset = TestError.objects.all()
    serializer_class = TestErrorSerializer

    def list(self, request, *args, **kwargs):
        global_report_ids = request.query_params.get("global_report_ids", None)
        global_report_id = request.query_params.get("global_report_id", None)
        profile_report_ids = request.query_params.get("profile_report_ids", None)
        profile_report_id = request.query_params.get("profile_report_id", None)

        if global_report_ids is not None:
            global_reports = GlobalReport.objects.filter(
                id__in=global_report_ids.split(",")
            )
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report__in=global_reports
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        elif global_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report=global_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif profile_report_ids is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report__in=profile_report_ids.split(",")
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif profile_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                profile_report=profile_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# -------------------- #
# - PROFILE REPORTS API - #
# -------------------- #


class ProfileReportViewSet(viewsets.ModelViewSet):
    queryset = ProfileReport.objects.all()
    serializer_class = ProfileReportSerializer

    def list(self, request, *args, **kwargs):
        global_report_ids = request.query_params.get("global_report_ids", None)
        global_report_id = request.query_params.get("global_report_id", None)

        if global_report_ids is not None:
            global_reports = GlobalReport.objects.filter(
                id__in=global_report_ids.split(",")
            )
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report__in=global_reports
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        elif global_report_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                global_report=global_report_id
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ---------------------- #
# - GLOBAL REPORTS API - #
# ---------------------- #


class GlobalReportViewSet(viewsets.ModelViewSet):
    queryset = GlobalReport.objects.all()
    serializer_class = GlobalReportSerializer

    def list(self, request, *args, **kwargs):
        test_cases = request.query_params.get("test_cases_ids", None)
        test_case = request.query_params.get("test_case_id", None)

        if test_cases is not None:
            test_cases = test_cases.split(",")
            queryset = self.filter_queryset(self.get_queryset()).filter(
                test_case__in=test_cases
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif test_case is not None:
            # Get the global report for a single test case
            queryset = (
                self.filter_queryset(self.get_queryset())
                .filter(test_case=test_case)
                .first()
            )
            serializer = self.get_serializer(queryset)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)


# ---------------------- #
# - CHATBOT TECHNOLOGY - #
# ---------------------- #


def get_technology_choices(request):
    return JsonResponse({"technology_choices": TECHNOLOGY_CHOICES})


class ChatbotTechnologyViewSet(viewsets.ModelViewSet):
    queryset = ChatbotTechnology.objects.all()
    serializer_class = ChatbotTechnologySerializer

    # Check if the technology name is already used
    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request):
        """Check if a technology name is already used. It cant be none or empty."""
        name = request.query_params.get("chatbot_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No technology name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = ChatbotTechnology.objects.filter(name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)


# ----------------- #
# - TEST CASES API #
# ----------------- #


class TestCaseViewSet(viewsets.ModelViewSet):
    queryset = TestCase.objects.all()
    serializer_class = TestCaseSerializer

    def list(self, request, *args, **kwargs):
        project_ids = request.query_params.get("project_ids", None)
        testcase_id = request.query_params.get("testcase_id", None)

        if project_ids is not None:
            projects = Project.objects.filter(id__in=project_ids.split(","))
            queryset = self.filter_queryset(self.get_queryset()).filter(
                project__in=projects
            )
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        elif testcase_id is not None:
            queryset = self.filter_queryset(self.get_queryset()).filter(id=testcase_id)
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        else:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request, *args, **kwargs):
        """Check if a test name is already used in the project.

        In the request query params, provide the `project_id` and `test_name`."""
        project_id = request.query_params.get("project_id", None)
        test_name = request.query_params.get("test_name", None)

        print(f"Test name: {test_name}")

        if project_id is None:
            return Response(
                {"error": "No project ID provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if test_name is None or not test_name.strip():
            return Response({"exists": False}, status=status.HTTP_200_OK)

        exists = TestCase.objects.filter(project=project_id, name=test_name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)


# ---------- #
# - PROJECTS #
# ---------- #


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    # For now we dont need pagination since there are not many projects
    # And it makes the frontend not be able to access response.data.length
    pagination_class = None

    @action(detail=False, methods=["get"], url_path="technologies")
    def list_technologies(self, request):
        """List all available Chatbot Technologies."""
        technologies = ChatbotTechnology.objects.all()
        serializer = ChatbotTechnologySerializer(technologies, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Check if the project name is already used
    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request):
        """Check if a project name is already used. It cant be none or empty."""
        name = request.query_params.get("project_name", None)
        if name is None or not name.strip():
            return Response(
                {"error": "No project name provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exists = Project.objects.filter(name=name).exists()
        return Response({"exists": exists}, status=status.HTTP_200_OK)


# ------------------------- #
# - USER PROFILES - YAMLS - #
# ------------------------- #


class TestFileViewSet(viewsets.ModelViewSet):
    queryset = TestFile.objects.all()
    serializer_class = TestFileSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # Own implementation because now if we delete a file, the row in the DB still exists
    def list(self, request, *args, **kwargs):
        """Return a list of all the YAML files uploaded, if one is missing, delete the row in the DB.

        Args:
            request (Request): The request object.

        Returns:
            Response: Serialized data of the files.
        """
        project_id = request.query_params.get("project_id", None)
        if project_id is not None:
            project = get_object_or_404(Project, id=project_id)
            queryset = self.filter_queryset(self.get_queryset()).filter(project=project)
        else:
            queryset = self.filter_queryset(self.get_queryset())

        # Check if a file is missing, if so, delete the row in the DB
        for file in queryset:
            if not os.path.exists(file.file.path):
                file.delete()

        # Repeat the query after possible deletions
        # queryset = self.filter_queryset(self.get_queryset())

        # Paginate the queryset if needed
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    # Allow bulk deletion of files without creating a new view
    @action(detail=False, methods=["delete"], url_path="delete-bulk")
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
        ids = request.data.get("ids", [])
        # This because if not when deleting a single file, it will be a single int and not a list
        if not isinstance(ids, list):
            ids = [ids]
        if not ids:
            return Response(
                {"error": "No IDs provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        files = TestFile.objects.filter(id__in=ids)
        if not files.exists():
            return Response(
                {"error": "No files found for the provided IDs."},
                status=status.HTTP_404_NOT_FOUND,
            )

        for file in files:
            file.delete()

        return Response({"deleted": len(files)}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        uploaded_files = request.FILES.getlist("file")
        project_id = request.data.get("project")
        errors = []
        test_names = set()
        already_reported_test_names = set()

        # Check if the project exists
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found, make sure to create a project first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Collect all existing test_names in the project
        existing_test_names = set(
            TestFile.objects.filter(project=project).values_list("name", flat=True)
        )

        # Validate all files first
        for f in uploaded_files:
            try:
                content = f.read()
                f.seek(0)  # Reset pointer so Django can save the file
                data = yaml.safe_load(content)
                test_name = data.get("test_name", None)
            except Exception as e:
                errors.append({"file": f.name, "error": f"Error reading YAML: {e}"})
                continue

            if not test_name:
                errors.append(
                    {"file": f.name, "error": "test_name is missing in YAML."}
                )
                continue

            if test_name in existing_test_names:
                if test_name not in already_reported_test_names:
                    already_reported_test_names.add(test_name)
                    errors.append(
                        {
                            "file": f.name,
                            "error": f"test_name '{test_name}' is already used.",
                        }
                    )
                continue

            if test_name in test_names:
                if test_name not in already_reported_test_names:
                    already_reported_test_names.add(test_name)
                    errors.append(
                        {
                            "file": f.name,
                            "error": f"Duplicate test_name '{test_name}' in uploaded files.",
                        }
                    )
                continue

            test_names.add(test_name)

        if errors:
            return Response(
                {"errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # All files are valid, proceed to save them atomically
        saved_files = []
        try:
            with transaction.atomic():
                for f in uploaded_files:
                    data = yaml.safe_load(f.read())
                    test_name = data.get("test_name")
                    instance = TestFile.objects.create(
                        file=f, name=test_name, project=project
                    )
                    saved_files.append(instance.id)
        except Exception as e:
            return Response(
                {"error": f"Failed to save files: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"uploaded_file_ids": saved_files}, status=status.HTTP_201_CREATED
        )


# ----------------------------- #
# - EXECUTE AUTOTEST ON FILES - #
# ----------------------------- #


class ExecuteSelectedAPIView(APIView):
    def post(self, request, format=None):
        """
        Execute selected test files in the user-yaml directory using Taskyto.
        Create a TestCase instance and associate executed TestFiles with it.
        """
        selected_ids = request.data.get("test_file_ids", [])
        project_id = request.data.get("project_id")
        test_name = request.data.get("test_name")

        if not selected_ids:
            return Response(
                {"error": "No test file IDs provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not project_id:
            return Response(
                {"error": "No project ID provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if the project exists
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found, make sure to create a project first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the technology and link from the project
        technology = project.chatbot_technology.technology
        link = project.chatbot_technology.link

        test_files = TestFile.objects.filter(id__in=selected_ids)
        if not test_files.exists():
            return Response(
                {"error": "No valid test files found for the provided IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Initialize total execution time and collect individual results
        copied_files = []

        # Prepare script paths
        base_dir = os.path.dirname(settings.BASE_DIR)
        script_path = os.path.join(base_dir, "user-simulator", "src", "autotest.py")

        # Load OPENAI_API_KEY from keys.properties
        check_keys(["OPENAI_API_KEY"])

        # Set executed dir to MEDIA / executed_yaml
        executed_dir_base = os.path.join(settings.MEDIA_ROOT, "executed_yaml")
        os.makedirs(executed_dir_base, exist_ok=True)
        print(f"Executed base dir: {executed_dir_base}")

        # Make in a transaction to avoid partial saves
        with transaction.atomic():
            # Create TestCase instance first to get its ID
            if test_name:
                print(f"Test name: {test_name}")
                test_case = TestCase.objects.create(project=project, name=test_name)
            else:
                test_case = TestCase.objects.create(project=project)

            # Set it to RUNNING
            test_case.status = "RUNNING"

            # Set extract dir to MEDIA / results / {test_case_id}
            extract_dir = os.path.join(
                settings.MEDIA_ROOT, "results", str(test_case.id)
            )
            print(f"Extract dir: {extract_dir}")

            # Create a unique subdirectory for this TestCase
            test_case_dir = os.path.join(executed_dir_base, f"testcase_{test_case.id}")
            os.makedirs(test_case_dir, exist_ok=True)
            print(f"TestCase directory: {test_case_dir}")

            # Copy all the yaml files to the new directory and save the relative path and name
            for test_file in test_files:
                file_path = test_file.file.path
                copied_file_path = shutil.copy(file_path, test_case_dir)
                # Store relative path from MEDIA_ROOT for frontend access
                copied_file_rel_path = os.path.relpath(
                    copied_file_path, settings.MEDIA_ROOT
                )
                # Get the test_name from the YAML file
                name_extracted = "Unknown"
                if os.path.exists(file_path):
                    try:
                        with open(file_path, "r") as file:
                            data = yaml.safe_load(file)
                            name_extracted = data.get("test_name", name_extracted)
                    except yaml.YAMLError as e:
                        print(f"Error loading YAML file: {e}")

                # Save the path and name of the copied file
                copied_files.append(
                    {"path": copied_file_rel_path, "name": name_extracted}
                )

            # Save the copied files to the TestCase instance
            test_case.copied_files = copied_files

            test_case.status = "RUNNING"
            test_case.save()

        # Set CWD to the script dir (avoid using os.chdir)
        script_cwd = os.path.dirname(os.path.dirname(script_path))
        print(f"Script path: {script_path}")

        # Execute the script for the directory with all the copied files
        # This is done to avoid the for loop, also we get just one report with all the files
        threading.Thread(
            target=run_asyn_test_execution,
            args=(
                script_path,
                script_cwd,
                test_case_dir,
                extract_dir,
                test_case,
                technology,
                link,
            ),
        ).start()

        return Response(
            {"message": "Started execution", "test_case_id": test_case.id},
            status=status.HTTP_202_ACCEPTED,
        )


def process_profile_report_from_conversation(conversation_file_path):
    """Read common fields from first conversation file"""
    to_print = False

    with open(conversation_file_path, "r") as file:
        data = yaml.safe_load_all(file)
        first_doc = next(data)

        # Extract conversation specs
        conv_specs = first_doc.get("conversation", {})
        interaction_style = next(
            (
                item["interaction_style"]
                for item in conv_specs
                if "interaction_style" in item
            ),
            {},
        )
        number = next((item["number"] for item in conv_specs if "number" in item), 0)
        steps = next((item["steps"] for item in conv_specs if "steps" in item), None)
        # Extract all_answered with limit if present
        all_answered_item = next(
            (item for item in conv_specs if "all_answered" in item), None
        )
        all_answered = None
        if all_answered_item:
            if isinstance(all_answered_item["all_answered"], dict):
                all_answered = all_answered_item["all_answered"]
            else:
                all_answered = {"value": all_answered_item["all_answered"]}

        if to_print:
            print("-" * 50)
            print("- PROFILE REPORT FROM CONVERSATION -")
            print(f"Serial: {first_doc.get('serial')}")
            print(f"Language: {first_doc.get('language')}")
            print(
                f"Personality: {next((item['personality'] for item in first_doc.get('context', []) if 'personality' in item), '')}"
            )
            print(
                f"Context details: {[(item) for item in first_doc.get('context', []) if 'personality' not in item]}"
            )
            print(f"Interaction style: {interaction_style}")
            print(f"Number conversations: {number}")

        return {
            "serial": first_doc.get("serial"),
            "language": first_doc.get("language"),
            "personality": next(
                (
                    item["personality"]
                    for item in first_doc.get("context", [])
                    if "personality" in item
                ),
                "",
            ),
            "context_details": [
                item
                for item in first_doc.get("context", [])
                if "personality" not in item
            ],
            "interaction_style": interaction_style,
            "number_conversations": number,
            "steps": steps,
            "all_answered": all_answered,
        }


def process_conversation(conversation_file_path):
    """Process individual conversation file"""
    with open(conversation_file_path, "r") as file:
        docs = list(yaml.safe_load_all(file))
        main_doc = docs[0]

        # Split the document at the separator lines
        conversation_data = {
            "ask_about": main_doc.get("ask_about", {}),
            "data_output": main_doc.get("data_output", {}),
            "errors": main_doc.get("errors", {}),
            "total_cost": float(main_doc.get("total_cost($)", 0)),
            "conversation_time": float(docs[1].get("conversation time", 0)),
            "response_times": docs[1].get("assistant response time", []),
            "response_time_avg": docs[1]
            .get("response time report", {})
            .get("average", 0),
            "response_time_max": docs[1].get("response time report", {}).get("max", 0),
            "response_time_min": docs[1].get("response time report", {}).get("min", 0),
            "interaction": docs[2].get("interaction", []),
        }
        return conversation_data


def run_asyn_test_execution(
    script_path, script_cwd, test_case_dir, extract_dir, test_case, technology, link
):
    """ """
    try:
        start_time = time.time()
        process = subprocess.Popen(
            [
                "python",
                script_path,
                "--technology",
                technology,
                "--chatbot",
                link,
                "--user",
                test_case_dir,
                "--extract",
                extract_dir,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=script_cwd,
        )
        stdout, stderr = process.communicate()
        end_time = time.time()
        elapsed_time = round(end_time - start_time, 2)

        test_case.execution_time = elapsed_time
        test_case.result = stdout.decode().strip() or stderr.decode().strip()
        test_case.status = "COMPLETED"
        print("COMPLETED")

        # Report saved in extract_dir / __report__ / report_*.yml
        report_path = os.path.join(extract_dir, "__report__")

        report_file = None
        for file in os.listdir(report_path):
            if file.startswith("report_") and file.endswith(".yml"):
                report_file = file
                break

        if report_file is not None:
            with open(os.path.join(report_path, report_file), "r") as file:
                documents = list(yaml.safe_load_all(file))
        else:
            # When the report is not created it is because there was an error
            test_case.result = "ERROR"

        # In the documents there is a global, and then a profile_report for each test_case

        # ----------------- #
        # - GLOBAL REPORT - #
        # ----------------- #
        global_report = documents[0]

        global_avg_response_time = global_report["Global report"][
            "Average assistant response time"
        ]
        global_min_response_time = global_report["Global report"][
            "Minimum assistant response time"
        ]
        global_max_response_time = global_report["Global report"][
            "Maximum assistant response time"
        ]

        global_total_cost = global_report["Global report"]["Total Cost"]

        global_report_instance = GlobalReport.objects.create(
            name="Global Report",
            avg_execution_time=global_avg_response_time,
            min_execution_time=global_min_response_time,
            max_execution_time=global_max_response_time,
            total_cost=global_total_cost,
            test_case=test_case,
        )

        global_report_instance.save()

        # Errors in the global report
        global_errors = global_report["Global report"]["Errors"]
        # print(f"Global errors: {global_errors}")
        for error in global_errors:
            error_code = error["error"]
            error_count = error["count"]
            error_conversations = [conv for conv in error["conversations"]]

            test_error = TestError.objects.create(
                code=error_code,
                count=error_count,
                conversations=error_conversations,
                global_report=global_report_instance,
            )

            test_error.save()

        global_report_instance.save()

        # ------------------- #
        # - PROFILE REPORTS - #
        # ------------------- #

        # Profile reports are in the documents from 1 to n
        for profile_report in documents[1:]:
            profile_report_name = profile_report["Test name"]
            profile_report_avg_response_time = profile_report[
                "Average assistant response time"
            ]
            profile_report_min_response_time = profile_report[
                "Minimum assistant response time"
            ]
            profile_report_max_response_time = profile_report[
                "Maximum assistant response time"
            ]

            test_total_cost = profile_report["Total Cost"]

            profile_report_instance = ProfileReport.objects.create(
                name=profile_report_name,
                avg_execution_time=profile_report_avg_response_time,
                min_execution_time=profile_report_min_response_time,
                max_execution_time=profile_report_max_response_time,
                total_cost=test_total_cost,
                global_report=global_report_instance,
                # Initialize common fields
                # Decided this so that if the first conversation file is missing, the profile report is still created
                serial="",
                language="",
                personality="",
                context_details=[],
                interaction_style={},
                number_conversations=0,
            )

            # Process conversations directory
            # It is the {project_id}/{profile_report_name}/{a date + hour}
            conversations_dir = os.path.join(extract_dir, profile_report_name)
            # Since we dont have the date and hour, we get the first directory (the only one)
            conversations_dir = os.path.join(
                conversations_dir, os.listdir(conversations_dir)[0]
            )
            print(f"Conversations dir: {conversations_dir}")
            if os.path.exists(conversations_dir):
                # Get the first conversation file to extract common fields
                conv_files = sorted(
                    [f for f in os.listdir(conversations_dir) if f.endswith(".yml")]
                )
                print(f"Conversation files: {conv_files}")
                if conv_files:
                    print(f"First conversation file: {conv_files[0]}")
                    first_conv_path = os.path.join(conversations_dir, conv_files[0])
                    profile_data = process_profile_report_from_conversation(
                        first_conv_path
                    )

                    # Update profile report with common fields
                    for field, value in profile_data.items():
                        setattr(profile_report_instance, field, value)
                    profile_report_instance.save()

                    # Process each conversation file
                    for conv_file in conv_files:
                        conv_path = os.path.join(conversations_dir, conv_file)
                        conv_data = process_conversation(conv_path)

                        Conversation.objects.create(
                            profile_report=profile_report_instance, **conv_data
                        )

            # Errors in the profile report
            test_errors = profile_report["Errors"]
            print(f"Test errors: {test_errors}")
            for error in test_errors:
                error_code = error["error"]
                error_count = error["count"]
                error_conversations = [conv for conv in error["conversations"]]

                test_error = TestError.objects.create(
                    code=error_code,
                    count=error_count,
                    conversations=error_conversations,
                    profile_report=profile_report_instance,
                )

                test_error.save()

            profile_report_instance.save()

        test_case.save()

    except Exception as e:
        test_case.result = f"Error: {e}"
        test_case.execution_time = 0
        test_case.status = "ERROR"
        test_case.save()

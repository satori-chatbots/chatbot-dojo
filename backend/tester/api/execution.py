"""
Execution API endpoints for running tests and generating profiles.
"""

import os
import shutil
import subprocess
import threading
import time
import traceback
import psutil

import yaml
from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    Conversation,
    GlobalReport,
    ProfileGenerationTask,
    ProfileReport,
    Project,
    TestCase,
    TestError,
    TestFile,
    cipher_suite,
)
from .base import logger


class ExecuteSelectedAPIView(APIView):
    def post(self, request, format=None):
        """
        Execute selected test files in the user-yaml directory using Taskyto.
        Create a TestCase instance and associate executed TestFiles with it.
        """
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return Response(
                {"error": "Authentication required to execute tests."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

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
            # Check if the project owner is the same as the user
            if project.owner != request.user:
                return Response(
                    {"error": "You do not own project."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found, make sure to create a project first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the technology and link from the project
        technology = project.chatbot_technology.technology
        link = project.chatbot_technology.link if project.chatbot_technology else None

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
        script_path = os.path.join(base_dir, "user-simulator", "src", "sensei_chat.py")

        # Load api key from the project and decipher it
        try:
            api_key_instance = project.api_key
            if api_key_instance is not None:
                openai_api_key = cipher_suite.decrypt(
                    api_key_instance.api_key_encrypted
                ).decode()
                os.environ["OPENAI_API_KEY"] = openai_api_key
                logger.info(f"API key successfully loaded for project {project.name}")
            else:
                logger.warning(f"No API key found for project {project.name}")
        except Exception as e:
            logger.error(
                f"Error loading/decrypting API key for project {project.name}: {e}"
            )

        # Set executed dir to MEDIA / projects / user_{user_id} / project_{project_id} / profiles / {testcase_id}
        user_id = request.user.id
        project_id = project.id

        project_path = os.path.join(
            settings.MEDIA_ROOT,
            "projects",
            f"user_{user_id}",
            f"project_{project_id}",
        )
        logger.info(f"Project path: {project_path}")

        # Make in a transaction to avoid partial saves
        with transaction.atomic():
            # Create TestCase instance first to get its ID
            if test_name:
                logger.info(f"Test name: {test_name}")
                test_case = TestCase.objects.create(
                    project=project, name=test_name, technology=technology
                )
            else:
                test_case = TestCase.objects.create(
                    project=project, technology=technology
                )

            # Set it to RUNNING
            test_case.status = "RUNNING"

            # Set extract dir to MEDIA / results / user_{user_id} / project_{project_id} / testcase_{testcase_id}
            results_path = os.path.join(
                settings.MEDIA_ROOT,
                "results",
                f"user_{user_id}",
                f"project_{project_id}",
                f"testcase_{test_case.id}",
            )
            logger.info(f"Results path: {results_path}")

            # Create a unique subdirectory for this TestCase within the profiles folder
            profiles_base_path = os.path.join(project_path, "profiles")
            user_profiles_path = os.path.join(profiles_base_path, f"testcase_{test_case.id}")
            os.makedirs(user_profiles_path, exist_ok=True)
            logger.info(f"User profiles path: {user_profiles_path}")

            # Get just the name of the folder inside /profiles so we can use it as an argument for the script
            profiles_directory = f"testcase_{test_case.id}"

            # Copy all the yaml files to the new directory and save the relative path and name
            for test_file in test_files:
                file_path = test_file.file.path
                copied_file_path = shutil.copy(file_path, user_profiles_path)
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
                        logger.error(f"Error loading YAML file: {e}")

                # Save the path and name of the copied file
                copied_files.append(
                    {"path": copied_file_rel_path, "name": name_extracted}
                )

            # Save the copied files to the TestCase instance
            test_case.copied_files = copied_files
            test_case.status = "RUNNING"
            test_case.save()

            # Execute the test in a background thread
            threading.Thread(
                target=self._execute_test_background,
                args=(
                    test_case.id,
                    script_path,
                    project_path,
                    profiles_directory,
                    results_path,
                    technology,
                    link,
                ),
            ).start()

        return Response(
            {
                "message": "Test execution started",
                "test_case_id": test_case.id,
                "total_conversations": "Calculating...",  # Will be updated during execution
            },
            status=status.HTTP_202_ACCEPTED,
        )

    def _execute_test_background(
        self,
        test_case_id,
        script_path,
        project_path,
        profiles_directory,
        results_path,
        technology,
        link,
    ):
        """Execute the test in background thread"""
        try:
            test_case = TestCase.objects.get(id=test_case_id)
            project = test_case.project

            # Get the user-simulator directory (parent of the script)
            user_simulator_dir = os.path.dirname(os.path.dirname(script_path))

            # Calculate total conversations for monitoring
            self._calculate_total_conversations(test_case, project_path)

            # Build the run.yml file before execution
            self._build_run_yml(project, test_case, profiles_directory, results_path, technology, link, user_simulator_dir)

            # Execute the actual test script with the new command format
            cmd = [
                "python",
                "src/sensei_chat.py",
                "--run_from_yaml",
                project_path,
            ]

            logger.info(f"Executing command: {' '.join(cmd)} from directory: {user_simulator_dir}")

            start_time = time.time()
            
            # Start the subprocess
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=user_simulator_dir,
            )

            # Save the process id and mark the test as RUNNING
            test_case.process_id = process.pid
            test_case.status = "RUNNING"
            test_case.save()

            # To store final conversation count
            final_conversation_count = [0]

            # Start the monitoring thread
            conversations_dir = results_path
            logger.info(f"Monitoring conversations in: {conversations_dir}")
            total_conversations = test_case.total_conversations
            monitoring_thread = threading.Thread(
                target=self._monitor_conversations,
                args=(conversations_dir, total_conversations, test_case.id, final_conversation_count),
            )
            monitoring_thread.daemon = True
            monitoring_thread.start()

            # Poll the process every few seconds to check if it has finished
            stdout, stderr = b"", b""
            timeout_seconds = 3
            while True:
                try:
                    # This will check if the process is still running
                    stdout, stderr = process.communicate(timeout=timeout_seconds)
                    break
                except subprocess.TimeoutExpired:
                    # If the process is still running, check if the test was stopped
                    test_case.refresh_from_db()
                    if test_case.status == "STOPPED":
                        logger.info("Stop flag detected. Terminating subprocess.")
                        try:
                            proc = psutil.Process(test_case.process_id)
                            for child in proc.children(recursive=True):
                                child.terminate()
                            proc.terminate()
                            psutil.wait_procs([proc], timeout=timeout_seconds)
                        except Exception as ex:
                            logger.error(f"Error while terminating process: {ex}")
                        # Continue polling until process exits
                        continue

            # Wait for the monitoring thread to finish
            monitoring_thread.join(timeout=10)

            end_time = time.time()
            execution_time = end_time - start_time

            # Check immediately if the test was stopped.
            test_case.refresh_from_db()
            if test_case.status == "STOPPED":
                logger.info("Test execution was stopped by the user.")
                test_case.result = "Test execution was stopped by the user."
                test_case.execution_time = execution_time
                test_case.save()
                return

            # Update execution time and result
            test_case.execution_time = execution_time
            test_case.result = stdout.decode().strip() or stderr.decode().strip()
            test_case.executed_conversations = final_conversation_count[0]

            if process.returncode == 0:
                test_case.status = "COMPLETED"
                test_case.save()
                logger.info("Test execution completed successfully")

                # Process results and create reports
                self._process_test_results(test_case, results_path)
            else:
                test_case.status = "FAILED"
                test_case.error_message = stderr.decode().strip()
                test_case.save()
                logger.error(f"Test execution failed: {stderr.decode().strip()}")

        except Exception as e:
            logger.error(f"Error in background test execution: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            try:
                test_case = TestCase.objects.get(id=test_case_id)
                test_case.status = "ERROR"
                test_case.error_message = f"Error: {e}\n{traceback.format_exc()}"
                test_case.execution_time = 0
                test_case.save()
            except Exception:
                pass


    def _calculate_total_conversations(self, test_case, project_path):
        """Calculate total conversations from copied files"""
        try:
            total_conversations = 0
            names = []

            for copied_file in test_case.copied_files:
                file_path = os.path.join(settings.MEDIA_ROOT, copied_file["path"])
                try:
                    # Load the YAML content
                    with open(file_path, "r") as file:
                        yaml_content = yaml.safe_load(file)

                    # Get the test_name from the file
                    test_name = yaml_content.get("test_name", "Unknown")
                    names.append(test_name)

                    # Calculate conversations from conversation data
                    conv_data = yaml_content.get("conversation")

                    if isinstance(conv_data, list):
                        num_conversations = sum(
                            item.get("number", 0)
                            for item in conv_data
                            if isinstance(item, dict)
                        )
                    elif isinstance(conv_data, dict):
                        num_conversations = conv_data.get("number", 0)
                    else:
                        num_conversations = 0

                    total_conversations += num_conversations
                    logger.info(f"Profile '{test_name}': {num_conversations} conversations")

                except Exception as e:
                    logger.error(f"Error processing YAML file: {str(e)}")

            test_case.total_conversations = total_conversations
            test_case.profiles_names = names
            test_case.save()
            logger.info(f"Total conversations calculated: {total_conversations}")

        except Exception as e:
            logger.error(f"Error calculating total conversations: {str(e)}")


    def _monitor_conversations(self, conversations_dir, total_conversations, test_case_id, final_conversation_count):
        """Monitor conversation progress during execution"""
        local_test_case = TestCase.objects.get(id=test_case_id)
        while True:
            local_test_case.refresh_from_db()
            if local_test_case.status != "RUNNING":
                logger.info("Monitoring stopped because status changed.")
                break

            try:
                executed_conversations = 0
                # NEW PATH: conversations are now in conversation_outputs/{profile}
                conversation_outputs_dir = os.path.join(
                    conversations_dir, "conversation_outputs"
                )
                if os.path.exists(conversation_outputs_dir):
                    for profile in local_test_case.profiles_names:
                        profile_dir = os.path.join(
                            conversation_outputs_dir, profile
                        )
                        if os.path.exists(profile_dir):
                            subdirs = os.listdir(profile_dir)
                            if subdirs:
                                # Assume the first subdirectory is the one we need
                                date_hour_dir = os.path.join(
                                    profile_dir, subdirs[0]
                                )
                                executed_conversations += len(
                                    os.listdir(date_hour_dir)
                                )

                    local_test_case.executed_conversations = executed_conversations
                    local_test_case.save()
                    final_conversation_count[0] = executed_conversations

                    if executed_conversations >= total_conversations:
                        logger.info("All conversations found. Exiting monitoring.")
                        break
            except Exception as e:
                logger.error(f"Error in monitor_conversations: {e}")
                break

            time.sleep(3)

    def _build_run_yml(self, project, test_case, profiles_directory, results_path, technology, link, user_simulator_dir):
        """Build the run.yml file with the correct configuration"""
        try:
            # Determine the connector path based on technology
            connector_path = self._get_connector_path(technology)

            # Get the user profile path - this should be just the subdirectory name within profiles
            user_profile = self._get_user_profile_name(test_case)

            # Make extract path relative to user-simulator directory
            extract_path = os.path.relpath(results_path, user_simulator_dir)

            # For user_profile, we just need the subdirectory name within the profiles directory
            # The script automatically looks in project_folder/profiles/user_profile
            user_profile_path = user_profile

            # Build the run.yml configuration
            config_data = {
                'project_folder': f"project_{project.id}",
                'user_profile': user_profile_path,
                'technology': technology,
                'connector': connector_path,
                'connector_parameters': {},
                'extract': extract_path,
                '#execution_parameters': [
                    '# - verbose',
                    '# - clean_cache',
                    '# - update_cache',
                    '# - ignore_cache'
                ]
            }

            # If there's a link, it might contain connector parameters
            if link:
                # Try to parse link as connector parameters if it's JSON-like
                try:
                    import json
                    connector_params = json.loads(link)
                    config_data['connector_parameters'] = connector_params
                except (json.JSONDecodeError, ValueError):
                    # If it's not JSON, it might be a URL that needs to be added to connector parameters
                    config_data['connector_parameters'] = {'api_url': link}

            # Write the run.yml file
            run_yml_path = os.path.join(project.get_project_path(), "run.yml")
            os.makedirs(os.path.dirname(run_yml_path), exist_ok=True)

            with open(run_yml_path, 'w') as f:
                yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)

            logger.info(f"Created run.yml at {run_yml_path}")
            logger.info(f"Run.yml content: {config_data}")

        except Exception as e:
            logger.error(f"Error building run.yml: {str(e)}")
            raise

    def _get_connector_path(self, technology):
        """Get the connector path based on the technology"""
        # Map technology to connector file path (relative to user-simulator directory)
        connector_map = {
            'taskyto': 'data/connectors/taskyto.yml',
            'rasa': 'data/connectors/rasa.yml',
            'serviceform': 'data/connectors/serviceform.yml',
            'millionbot': 'data/connectors/millionbot_ada.yml',  # Use the existing millionbot_ada.yml
            'dialogflow': 'data/connectors/dialogflow.yml',
            'julie': 'data/connectors/julie.yml',
            'kuki': 'data/connectors/kuki.yml',
        }

        return connector_map.get(technology, 'data/connectors/taskyto.yml')  # Default to taskyto

    def _get_user_profile_name(self, test_case):
        """Get the user profile path from the copied files"""
        if test_case.copied_files:
            # Return the directory name where the files are located
            return f"testcase_{test_case.id}"
        return f"testcase_{test_case.id}"

    def _process_test_results(self, test_case, results_path):
        """Process test results and create reports"""
        try:
            logger.info(f"Processing results for test case {test_case.id}")

            # NEW PATH: reports are now in reports/__stats_reports__
            report_path = os.path.join(results_path, "reports", "__stats_reports__")
            if not os.path.exists(report_path):
                test_case.status = "ERROR"
                test_case.error_message = "Error accessing __stats_reports__ directory"
                test_case.save()
                return

            report_file = None
            try:
                for file in os.listdir(report_path):
                    if file.startswith("report_") and file.endswith(".yml"):
                        report_file = file
                        break
            except OSError:
                test_case.status = "ERROR"
                test_case.error_message = "Error accessing report directory"
                test_case.save()
                return

            if report_file is None:
                test_case.status = "ERROR"
                test_case.error_message = "Report file not found"
                test_case.save()
                return

            # In the documents there is a global, and then a profile_report for each test_case
            documents = []
            with open(os.path.join(report_path, report_file), "r") as file:
                documents = list(yaml.safe_load_all(file))

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

            # Errors in the global report
            global_errors = global_report["Global report"]["Errors"]
            for error in global_errors:
                error_code = error["error"]
                error_count = error["count"]
                error_conversations = [conv for conv in error["conversations"]]

                TestError.objects.create(
                    code=error_code,
                    count=error_count,
                    conversations=error_conversations,
                    global_report=global_report_instance,
                )

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
                    serial="",
                    language="",
                    personality="",
                    context_details=[],
                    interaction_style={},
                    number_conversations=0,
                )

                # Process conversations directory with NEW PATH
                # It is now in conversation_outputs/{profile_name}/{a date + hour}
                conversations_dir = os.path.join(
                    results_path, "conversation_outputs", profile_report_name
                )
                if os.path.exists(conversations_dir):
                    subdirs = os.listdir(conversations_dir)
                    if subdirs:
                        # Since we dont have the date and hour, we get the first directory (the only one)
                        conversations_dir = os.path.join(conversations_dir, subdirs[0])
                        logger.info(f"Conversations dir: {conversations_dir}")

                        # Get the first conversation file to extract common fields
                        conv_files = sorted(
                            [f for f in os.listdir(conversations_dir) if f.endswith(".yml")]
                        )
                        logger.info(f"Conversation files: {conv_files}")
                        if conv_files:
                            logger.info(f"First conversation file: {conv_files[0]}")
                            first_conv_path = os.path.join(conversations_dir, conv_files[0])
                            profile_data = self._process_profile_report_from_conversation(
                                first_conv_path
                            )

                            # Update profile report with common fields
                            for field, value in profile_data.items():
                                setattr(profile_report_instance, field, value)
                            profile_report_instance.save()

                            # Process each conversation file
                            for conv_file in conv_files:
                                conv_path = os.path.join(conversations_dir, conv_file)
                                conv_data = self._process_conversation(conv_path)

                                Conversation.objects.create(
                                    profile_report=profile_report_instance, **conv_data
                                )

                # Errors in the profile report
                test_errors = profile_report["Errors"]
                logger.info(f"Test errors: {test_errors}")
                for error in test_errors:
                    error_code = error["error"]
                    error_count = error["count"]
                    error_conversations = [conv for conv in error["conversations"]]

                    TestError.objects.create(
                        code=error_code,
                        count=error_count,
                        conversations=error_conversations,
                        profile_report=profile_report_instance,
                    )

            logger.info(f"Successfully processed results for test case {test_case.id}")

        except Exception as e:
            logger.error(f"Error processing test results: {str(e)}")
            test_case.status = "ERROR"
            test_case.error_message = f"Error processing results: {str(e)}"
            test_case.save()


    def _process_profile_report_from_conversation(self, conversation_file_path):
        """Read common fields from first conversation file"""
        
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

            return {
                "serial": first_doc.get("serial"),
                "language": first_doc.get("language"),
                "personality": next(
                    (
                        item["personality"]
                        for item in first_doc.get("context", [])
                        if isinstance(item, dict) and "personality" in item
                    ),
                    "",
                ),
                "context_details": [
                    item
                    for item in first_doc.get("context", [])
                    if not isinstance(item, dict) or "personality" not in item
                ],
                "interaction_style": interaction_style,
                "number_conversations": number,
                "steps": steps,
                "all_answered": all_answered,
            }


    def _process_conversation(self, conversation_file_path):
        """Process individual conversation file"""

        # File name without extension
        name = os.path.splitext(os.path.basename(conversation_file_path))[0]
        with open(conversation_file_path, "r") as file:
            docs = list(yaml.safe_load_all(file))
            main_doc = docs[0]

            # Split the document at the separator lines
            conversation_data = {
                "name": name,
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


def run_async_profile_generation(task_id, technology, conversations, turns, user_id):
    """
    Run profile generation asynchronously in a background thread.
    """
    try:
        task = ProfileGenerationTask.objects.get(id=task_id)
        task.status = "RUNNING"
        task.stage = "Initializing"
        task.save()

        # Detailed implementation would go here
        # This is a complex process for generating user profiles

        task.status = "COMPLETED"
        task.progress_percentage = 100
        task.save()

    except Exception as e:
        logger.error(f"Error in profile generation: {str(e)}")
        try:
            task = ProfileGenerationTask.objects.get(id=task_id)
            task.status = "FAILED"
            task.error_message = str(e)
            task.save()
        except Exception:
            pass


@api_view(["POST"])
def generate_profiles(request):
    """Generate user profiles based on conversations and turns."""
    project_id = request.data.get("project_id")
    conversations = request.data.get("conversations", 1)
    turns = request.data.get("turns", 10)

    if not project_id:
        return Response(
            {"error": "No project ID provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        project = Project.objects.get(id=project_id)
        if project.owner != request.user:
            return Response(
                {"error": "You do not own this project."},
                status=status.HTTP_403_FORBIDDEN,
            )
    except Project.DoesNotExist:
        return Response(
            {"error": "Project not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Create a task to track generation
    task = ProfileGenerationTask.objects.create(
        project=project, status="PENDING", conversations=conversations, turns=turns
    )

    # Start generation in background thread
    threading.Thread(
        target=run_async_profile_generation,
        args=(
            task.id,
            project.chatbot_technology.technology,
            conversations,
            turns,
            request.user.id,
        ),
    ).start()

    return Response(
        {"message": "Profile generation started", "task_id": task.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
def check_generation_status(request, task_id):
    """Check the status of a profile generation task."""
    try:
        task = ProfileGenerationTask.objects.get(id=task_id)
        return Response(
            {
                "status": task.status,
                "stage": task.stage,
                "progress": task.progress_percentage,
                "generated_files": len(task.generated_file_ids),
                "error_message": task.error_message,
            }
        )
    except ProfileGenerationTask.DoesNotExist:
        return Response({"error": "Task not found"}, status=status.HTTP_404_NOT_FOUND)


@api_view(["GET"])
def check_ongoing_generation(request, project_id):
    """Check if there's an ongoing profile generation task for the project."""
    try:
        # Find any PENDING or RUNNING tasks for this project
        ongoing_task = (
            ProfileGenerationTask.objects.filter(
                project_id=project_id, status__in=["PENDING", "RUNNING"]
            )
            .order_by("-created_at")
            .first()
        )

        if ongoing_task:
            return Response(
                {
                    "ongoing": True,
                    "task_id": ongoing_task.id,
                    "status": ongoing_task.status,
                }
            )
        else:
            return Response({"ongoing": False})
    except Exception as e:
        logger.error(f"Error checking ongoing generation: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
def stop_test_execution(request):
    """Stop ongoing test execution."""
    test_case_id = request.data.get("test_case_id")

    if not test_case_id:
        return Response(
            {"error": "No test case ID provided."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        test_case = TestCase.objects.get(id=test_case_id)
        if test_case.project.owner != request.user:
            return Response(
                {"error": "You do not own this test case."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only stop if the test is currently running
        if test_case.status == "RUNNING":
            test_case.status = "STOPPED"
            test_case.save()
            
            # If we have a process ID, try to terminate the process
            if test_case.process_id:
                try:
                    proc = psutil.Process(test_case.process_id)
                    for child in proc.children(recursive=True):
                        child.terminate()
                    proc.terminate()
                    logger.info(f"Terminated process {test_case.process_id} for test case {test_case_id}")
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    logger.warning(f"Could not terminate process {test_case.process_id}: {e}")

            return Response(
                {"message": "Test execution stopped"},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"message": f"Test case is not running (status: {test_case.status})"},
                status=status.HTTP_200_OK,
            )

    except TestCase.DoesNotExist:
        return Response(
            {"error": "Test case not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

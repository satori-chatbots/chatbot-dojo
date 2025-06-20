"""Test execution and management functionality.
"""

import os
import subprocess
import threading
import time
import traceback

import psutil

from ..models import TestCase
from .base import logger
from .execution_utils import ExecutionUtils
from .results_processor import ResultsProcessor


class TestRunner:
    """Handles test execution, monitoring, and process management."""

    def __init__(self):
        self.results_processor = ResultsProcessor()
        self.execution_utils = ExecutionUtils()

    def execute_test_background(
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
            self.execution_utils.calculate_total_conversations(test_case, project_path)

            # Build the run.yml file before execution
            self._build_run_yml(
                project,
                test_case,
                profiles_directory,
                results_path,
                technology,
                link,
                user_simulator_dir,
            )

            # Execute the actual test script with the new command format
            cmd = [
                "python",
                "src/sensei_chat.py",
                "--run_from_yaml",
                project_path,
            ]

            logger.info(
                f"Executing command: {' '.join(cmd)} from directory: {user_simulator_dir}"
            )

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
                args=(
                    conversations_dir,
                    total_conversations,
                    test_case.id,
                    final_conversation_count,
                ),
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
                self.results_processor.process_test_results(test_case, results_path)
            else:
                test_case.status = "FAILED"
                test_case.error_message = stderr.decode().strip()
                test_case.save()
                logger.error(f"Test execution failed: {stderr.decode().strip()}")

        except Exception as e:
            logger.error(f"Error in background test execution: {e!s}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            try:
                test_case = TestCase.objects.get(id=test_case_id)
                test_case.status = "ERROR"
                test_case.error_message = f"Error: {e}\n{traceback.format_exc()}"
                test_case.execution_time = 0
                test_case.save()
            except Exception:
                pass

    def stop_test_execution(self, test_case):
        """Stop a running test execution."""
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
                    logger.info(
                        f"Terminated process {test_case.process_id} for test case {test_case.id}"
                    )
                    return True
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    logger.warning(
                        f"Could not terminate process {test_case.process_id}: {e}"
                    )
                    return True  # Still consider it successful since we set status to STOPPED
            return True
        return False

    def _build_run_yml(
        self,
        project,
        test_case,
        profiles_directory,
        results_path,
        technology,
        link,
        user_simulator_dir,
    ):
        """Build the run.yml file with the correct configuration"""
        try:
            # Build configuration using ExecutionUtils
            config_data = self.execution_utils.build_run_yml_config(
                project,
                test_case,
                profiles_directory,
                results_path,
                technology,
                link,
                user_simulator_dir,
            )

            # Write the configuration to file
            self.execution_utils.write_run_yml(config_data, project)

        except Exception as e:
            logger.error(f"Error building run.yml: {e!s}")
            raise

    def _monitor_conversations(
        self,
        conversations_dir,
        total_conversations,
        test_case_id,
        final_conversation_count,
    ):
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
                        profile_dir = os.path.join(conversation_outputs_dir, profile)
                        if os.path.exists(profile_dir):
                            subdirs = os.listdir(profile_dir)
                            if subdirs:
                                # Assume the first subdirectory is the one we need
                                date_hour_dir = os.path.join(profile_dir, subdirs[0])
                                executed_conversations += len(os.listdir(date_hour_dir))

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

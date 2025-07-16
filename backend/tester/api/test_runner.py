"""Test execution and management functionality."""

import json
import os
import subprocess
import threading
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import psutil

from tester.models import TestCase

from .base import logger
from .execution_utils import ExecutionUtils, RunYmlConfigParams
from .results_processor import ResultsProcessor

if TYPE_CHECKING:
    from collections.abc import Callable

ERROR_MSG_TRUNCATE_LENGTH = 200
TWO_ARGS = 2


@dataclass
class TestExecutionConfig:
    """Configuration for test execution."""

    test_case_id: int
    script_path: str
    project_path: str
    profiles_directory: str
    results_path: str
    technology: str
    link: str
    api_key: str | None
    api_provider: str | None


@dataclass
class ExecutionResult:
    """Result data from test execution."""

    process: subprocess.Popen[bytes]
    stdout: bytes
    stderr: bytes
    executed_conversations: int


class TestRunner:
    """Handles test execution, monitoring, and process management."""

    def __init__(self) -> None:
        """Initialize the TestRunner."""
        self.results_processor = ResultsProcessor()
        self.execution_utils = ExecutionUtils()

    @staticmethod
    def _get_api_key_env_var(provider: str | None) -> str:
        """Get the environment variable name for the given LLM provider."""
        provider_env_vars = {
            "openai": "OPENAI_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "google": "GOOGLE_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "azure": "AZURE_OPENAI_API_KEY",
            "cohere": "COHERE_API_KEY",
            "huggingface": "HUGGINGFACEHUB_API_TOKEN",
            "mistral": "MISTRAL_API_KEY",
            "groq": "GROQ_API_KEY",
        }

        if provider and provider.lower() in provider_env_vars:
            return provider_env_vars[provider.lower()]

        # Default to OpenAI for backward compatibility
        return "OPENAI_API_KEY"

    def execute_test_background(self, config: TestExecutionConfig) -> None:
        """Execute the test in a background thread."""
        self._run_test_execution(config)

    def stop_test_execution(self, test_case: TestCase) -> bool:
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
                    logger.info(f"Terminated process {test_case.process_id} for test case {test_case.id}")
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    logger.warning(f"Could not terminate process {test_case.process_id}: {e}")
                else:
                    return True
            return True
        return False

    def _monitor_conversations(
        self,
        conversations_dir: str,
        total_conversations: int,
        test_case_id: int,
        final_conversation_count: list[int],
    ) -> None:
        """Monitor conversation progress during execution."""
        local_test_case = TestCase.objects.get(id=test_case_id)
        while True:
            local_test_case.refresh_from_db()
            if local_test_case.status != "RUNNING":
                logger.info("Monitoring stopped because status changed.")
                break

            try:
                executed_conversations = 0
                # NEW PATH: conversations are now in conversation_outputs/{profile}
                conversation_outputs_dir = Path(conversations_dir) / "conversation_outputs"
                if conversation_outputs_dir.exists():
                    for profile in local_test_case.profiles_names:
                        profile_dir = conversation_outputs_dir / profile
                        if profile_dir.exists():
                            subdirs = list(profile_dir.iterdir())
                            if subdirs:
                                # Assume the first subdirectory is the one we need
                                date_hour_dir = subdirs[0]
                                executed_conversations += len(list(date_hour_dir.iterdir()))

                    local_test_case.executed_conversations = executed_conversations
                    local_test_case.save()
                    final_conversation_count[0] = executed_conversations

                    if executed_conversations >= total_conversations:
                        logger.info("All conversations found. Exiting monitoring.")
                        break
            # BLE001: Catching broad exception in a monitoring loop is acceptable
            # to prevent the monitor from crashing due to transient filesystem issues.
            except Exception as e:  # noqa: BLE001
                logger.error(f"Error in monitor_conversations: {e}")
                break

            time.sleep(3)

    def _run_test_execution(self, config: TestExecutionConfig) -> None:
        """Run the actual test execution with error handling."""
        try:
            test_case = TestCase.objects.get(id=config.test_case_id)

            # Setup test execution
            process, monitoring_thread, final_conversation_count = self._setup_test_execution(test_case, config)

            # Execute and monitor process
            stdout, stderr = self._execute_and_monitor_process(process, test_case, monitoring_thread)

            # Process results
            execution_result = ExecutionResult(
                process=process, stdout=stdout, stderr=stderr, executed_conversations=final_conversation_count[0]
            )
            self._process_execution_results(test_case, execution_result, config.results_path)

        # BLE001: This is a top-level exception handler for a background thread.
        # It's crucial to catch any unexpected error to prevent the thread from crashing silently.
        except Exception as e:  # noqa: BLE001
            self._handle_execution_error(config.test_case_id, e)

    def _build_command(self, config_data: dict, project_path: str, script_path: str) -> list[str]:
        """Build the command to execute the test script."""
        cmd = [
            "python",
            script_path,
            "--technology",
            config_data["technology"],
            "--connector",
            config_data["connector"],
            "--project_path",
            project_path,
            "--user_profile",
            config_data["user_profile"],
            "--extract",
            config_data["extract"],
            "--verbose",
        ]
        if config_data.get("connector_parameters"):
            cmd.extend(
                [
                    "--connector_parameters",
                    json.dumps(config_data["connector_parameters"]),
                ]
            )
        return cmd

    def _setup_test_execution(
        self, test_case: TestCase, config: TestExecutionConfig
    ) -> tuple[subprocess.Popen[bytes], threading.Thread, list[int]]:
        """Setup test execution configuration and start monitoring."""
        project = test_case.project
        user_simulator_dir = str(Path(config.script_path).parent.parent)

        # Calculate total conversations for monitoring
        self.execution_utils.calculate_total_conversations(test_case)

        # Build config for command line arguments
        config_data = self.execution_utils.build_run_yml_config(
            RunYmlConfigParams(
                project=project,
                test_case=test_case,
                results_path=config.results_path,
                technology=config.technology,
                link=config.link,
                user_simulator_dir=user_simulator_dir,
            )
        )

        # Build command (now passing the absolute script path)
        cmd = self._build_command(config_data, config.project_path, config.script_path)
        logger.info(f"Executing command: {' '.join(cmd)} from directory: {user_simulator_dir}")

        # Prepare environment for subprocess
        env = os.environ.copy()
        if config.api_key:
            # Set the correct environment variable based on the provider
            env_var_name = self._get_api_key_env_var(config.api_provider)
            env[env_var_name] = config.api_key
            logger.info(f"Setting {env_var_name} environment variable for provider: {config.api_provider}")

        # Start the subprocess
        # S603: Trusted source
        process = subprocess.Popen(  # noqa: S603
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=user_simulator_dir,
            env=env,
        )

        # Save the process id and mark the test as RUNNING
        test_case.process_id = process.pid
        test_case.status = "RUNNING"
        test_case.save()

        # Start monitoring thread
        final_conversation_count = [0]
        monitoring_thread = self._start_monitoring_thread(config.results_path, test_case, final_conversation_count)

        return process, monitoring_thread, final_conversation_count

    def _start_monitoring_thread(
        self, conversations_dir: str, test_case: TestCase, final_conversation_count: list[int]
    ) -> threading.Thread:
        """Start the monitoring thread for conversation progress."""
        logger.info(f"Monitoring conversations in: {conversations_dir}")
        monitoring_thread = threading.Thread(
            target=self._monitor_conversations,
            args=(
                conversations_dir,
                test_case.total_conversations,
                test_case.id,
                final_conversation_count,
            ),
        )
        monitoring_thread.daemon = True
        monitoring_thread.start()
        return monitoring_thread

    def _execute_and_monitor_process(
        self, process: subprocess.Popen[bytes], test_case: TestCase, monitoring_thread: threading.Thread
    ) -> tuple[bytes, bytes]:
        """Execute process and monitor it for completion or stop signals."""
        stdout, stderr = b"", b""
        timeout_seconds = 3

        while True:
            try:
                stdout, stderr = process.communicate(timeout=timeout_seconds)
                break
            except subprocess.TimeoutExpired:
                test_case.refresh_from_db()
                if test_case.status == "STOPPED":
                    self._terminate_process(test_case.process_id, timeout_seconds)
                    continue

        # Wait for the monitoring thread to finish
        monitoring_thread.join(timeout=10)
        return stdout, stderr

    def _terminate_process(self, process_id: int, timeout_seconds: int) -> None:
        """Terminate the test process and its children."""
        logger.info("Stop flag detected. Terminating subprocess.")
        try:
            proc = psutil.Process(process_id)
            for child in proc.children(recursive=True):
                child.terminate()
            proc.terminate()
            psutil.wait_procs([proc], timeout=timeout_seconds)
        except psutil.Error as ex:
            logger.error(f"Error while terminating process: {ex}")

    def _process_execution_results(
        self, test_case: TestCase, execution_result: ExecutionResult, results_path: str
    ) -> None:
        """Process the execution results and update test case status."""
        end_time = time.time()

        # Use the executed_at field as the start time (when test case was created and started)
        start_time = test_case.executed_at.timestamp()
        execution_time = end_time - start_time

        # Check if the test was stopped
        test_case.refresh_from_db()
        if test_case.status == "STOPPED":
            logger.info("Test execution was stopped by the user.")
            test_case.stdout = "Test execution was stopped by the user."
            test_case.result = test_case.stdout  # For backward compatibility
            test_case.execution_time = execution_time
            test_case.save()
            return

        # Update execution results
        test_case.execution_time = execution_time
        test_case.stdout = execution_result.stdout.decode().strip()
        test_case.stderr = execution_result.stderr.decode().strip()
        # Keep result field for backward compatibility (combine stdout and stderr)
        test_case.result = test_case.stdout or test_case.stderr
        test_case.executed_conversations = execution_result.executed_conversations

        if execution_result.process.returncode == 0:
            test_case.status = "COMPLETED"
            test_case.save()
            logger.info("Test execution completed successfully")
            self.results_processor.process_test_results(test_case, results_path)
        else:
            test_case.status = "ERROR"
            # Parse error message from stderr for better user display
            error_output = test_case.stderr
            test_case.error_message = self._parse_sensei_error_message(error_output)
            test_case.save()
            logger.error(f"Test execution failed: {error_output}")

    def _parse_sensei_error_message(self, stderr_output: str) -> str:
        """Parse Sensei error output to provide meaningful error messages."""
        if not stderr_output:
            return "Unknown error occurred during Sensei execution"

        lower_output = stderr_output.lower()
        error_patterns: list[tuple[Callable[..., bool], str]] = [
            (
                lambda lo: "connection" in lo and ("refused" in lo or "timeout" in lo),
                "Connection failed: Unable to connect to the chatbot. Please check your connector configuration and ensure the chatbot is running.",
            ),
            (
                lambda lo, so: "authentication" in lo or "unauthorized" in lo or "401" in so,
                "Authentication failed: Please check your API key and connector authentication settings.",
            ),
            (
                lambda lo: "api key" in lo or "openai_api_key" in lo,
                "API key error: Please verify your API key configuration in the project settings.",
            ),
            (
                lambda lo: "json" in lo and ("decode" in lo or "parse" in lo),
                "Response parsing error: The chatbot returned an invalid response format. Please check your connector configuration.",
            ),
            (
                lambda lo: "file not found" in lo or "no such file" in lo,
                "File error: Required profile files are missing or inaccessible.",
            ),
            (
                lambda lo: "permission denied" in lo,
                "Permission error: Insufficient permissions to access required files or directories.",
            ),
            (
                lambda lo: "module not found" in lo or "import" in lo,
                "Dependency error: Required Python modules are missing. Please contact support.",
            ),
        ]

        for condition, message in error_patterns:
            try:
                # Try calling with both arguments; fallback to one if TypeError
                if condition.__code__.co_argcount == TWO_ARGS:
                    if condition(lower_output, stderr_output):
                        return message
                elif condition(lower_output):
                    return message
            except TypeError as e:
                logger.warning(f"Error calling error pattern lambda: {e}")
                continue

        # Extract the first line of error for concise display
        first_line = stderr_output.split("\n")[0].strip()
        if first_line:
            return f"Execution error: {first_line}"
        if len(stderr_output) > ERROR_MSG_TRUNCATE_LENGTH:
            return stderr_output[:ERROR_MSG_TRUNCATE_LENGTH] + "..."
        return stderr_output

    def _handle_execution_error(self, test_case_id: int, error: Exception) -> None:
        """Handle errors during test execution."""
        logger.error(f"Error in background test execution: {error!s}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        try:
            test_case = TestCase.objects.get(id=test_case_id)
            test_case.status = "ERROR"
            test_case.error_message = f"Error: {error}\n{traceback.format_exc()}"
            test_case.execution_time = 0
            test_case.save()
        # BLE001: If updating the DB fails during critical error handling, we can't do much more.
        except Exception:  # noqa: BLE001
            logger.exception("Failed to update test case status to ERROR after a critical failure.")

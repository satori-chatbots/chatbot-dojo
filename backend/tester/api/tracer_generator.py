"""TRACER profile generation core functionality."""

import os
import re
import shlex
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from celery.app.task import Task

from django.conf import settings
from django.db import DatabaseError, IntegrityError

# Import TRACER custom exceptions for proper error handling
# Use a more robust import approach to avoid redefinition issues
try:
    from tracer import (
        ConnectorAuthenticationError,
        ConnectorConfigurationError,
        ConnectorConnectionError,
        ConnectorError,
        ConnectorResponseError,
        GraphvizNotInstalledError,
        LLMError,
        TracerError,
    )
except ImportError:
    # Create a simple base exception if TRACER is not available
    # This is just for type checking and won't be used in practice
    TracerError = Exception
    GraphvizNotInstalledError = Exception
    ConnectorError = Exception
    ConnectorConnectionError = Exception
    ConnectorAuthenticationError = Exception
    ConnectorConfigurationError = Exception
    ConnectorResponseError = Exception
    LLMError = Exception


from tester.api.base import logger

# Import here to avoid circular imports in runtime, but linter prefers top-level
from tester.api.tracer_parser import TracerResultsProcessor
from tester.models import ChatbotConnector, ProfileExecution, ProfileGenerationTask, Project

# Mapping of TRACER exceptions to error type codes for the database
TRACER_EXCEPTION_MAPPING = {
    "GraphvizNotInstalledError": "GRAPHVIZ_NOT_INSTALLED",
    "ConnectorConnectionError": "CONNECTOR_CONNECTION",
    "ConnectorAuthenticationError": "CONNECTOR_AUTHENTICATION",
    "ConnectorConfigurationError": "CONNECTOR_CONFIGURATION",
    "ConnectorResponseError": "CONNECTOR_RESPONSE",
    "LLMError": "LLM_ERROR",
    "ConnectorError": "CONNECTOR_ERROR",
    "TracerError": "TRACER_ERROR",
}


@dataclass
class ProfileGenerationParams:
    """Parameter object for TRACER profile generation configuration."""

    technology: str
    conversations: int
    turns: int
    verbosity: str
    user_id: Any
    api_key: str | None
    graph_format: str = "all"


class TracerGenerator:
    """Handles TRACER profile generation execution with real TRACER integration."""

    @staticmethod
    def get_api_key_env_var(provider: str | None) -> str:
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

    def run_async_profile_generation(
        self,
        task_id: int,
        params: ProfileGenerationParams,
        celery_task: "Task | None" = None,
    ) -> None:
        """Run profile generation asynchronously using real TRACER."""
        task = None
        execution = None

        try:
            task = self._initialize_task(task_id, celery_task)
            execution = self._create_execution(task, params.conversations, params.turns, params.verbosity)

            success = self.execute_tracer_generation(task, execution, params, celery_task)

            self._finalize_execution(task, execution, success=success, celery_task=celery_task)

        except ProfileGenerationTask.DoesNotExist:
            logger.error(f"ProfileGenerationTask with ID {task_id} not found")
            # Task doesn't exist, can't update it - this IS a Django app error
        except (DatabaseError, IntegrityError, OSError) as e:
            # This is likely a Django application error, not a user execution error
            logger.error(f"Unexpected Django error in TRACER profile generation for task {task_id}: {e!s}")

            # Generate a user-friendly error message for unexpected errors
            error_message = "An unexpected error occurred during profile generation. Please try again or contact support if the issue persists."

            # Try to update task and execution if they exist
            if task:
                try:
                    task.status = "FAILURE"
                    task.error_message = error_message
                    task.save()
                except (DatabaseError, IntegrityError) as save_error:
                    logger.critical(f"Failed to save error status to task {task_id}: {save_error!s}")

            if execution:
                try:
                    execution.status = "FAILURE"
                    execution.save()
                except (DatabaseError, IntegrityError) as save_error:
                    logger.critical(f"Failed to save error status to execution: {save_error!s}")

            # Don't re-raise the exception to prevent console spam
            # The error is logged and stored in the database for user visibility

    def _initialize_task(self, task_id: int, celery_task: "Task | None" = None) -> ProfileGenerationTask:
        """Initialize and update task status."""
        task = ProfileGenerationTask.objects.get(id=task_id)
        task.status = "RUNNING"
        task.stage = "INITIALIZING"
        task.save()

        # Update Celery task state if available
        if celery_task:
            celery_task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "INITIALIZING",
                    "progress": 0,
                },
            )

        logger.info(f"Starting TRACER profile generation for task {task_id}")
        return task

    def _create_execution(
        self, task: ProfileGenerationTask, conversations: int, turns: int, verbosity: str
    ) -> ProfileExecution:
        """Create execution record for the task."""
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        execution_name = f"TRACER_{timestamp}"

        execution = ProfileExecution.objects.create(
            project=task.project,
            execution_name=execution_name,
            execution_type="tracer",
            sessions=conversations,
            turns_per_session=turns,
            verbosity=verbosity,
            status="RUNNING",
            profiles_directory=f"project_data/{task.project.id}/executions/{execution_name.lower()}",
        )

        task.execution = execution
        task.save()
        return execution

    def _finalize_execution(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        *,
        success: bool,
        celery_task: "Task | None" = None,
    ) -> None:
        """Finalize task and execution status based on success."""
        if success:
            task.status = "SUCCESS"
            task.progress_percentage = 100
            task.stage = "COMPLETED"
            execution.status = "SUCCESS"

            # Update Celery task state if available
            if celery_task:
                celery_task.update_state(
                    state="SUCCESS",
                    meta={
                        "stage": "COMPLETED",
                        "progress": 100,
                    },
                )

            logger.info(f"TRACER profile generation completed for task {task.id}")
        else:
            task.status = "FAILURE"
            # Only set a generic error message if we don't already have a specific one
            if not task.error_message or task.error_message.strip() == "":
                task.error_message = "TRACER execution failed - check logs for details"
            execution.status = "FAILURE"

            # Update Celery task state if available
            if celery_task:
                celery_task.update_state(
                    state="FAILURE",
                    meta={
                        "stage": "ERROR",
                        "progress": task.progress_percentage,
                        "error_message": task.error_message,
                    },
                )

            logger.info(f"TRACER profile generation failed for task {task.id}: {task.error_message}")

        task.save()
        execution.save()

    def execute_tracer_generation(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        params: ProfileGenerationParams,
        celery_task: "Task | None" = None,
    ) -> bool:
        """Execute TRACER command and process results."""
        try:
            self._validate_project_configuration(task.project)
            output_dir = self._setup_output_directory(execution)

            # Update progress
            task.progress_percentage = 20
            task.stage = "CREATING_PROFILES"
            task.save()

            # Update Celery task state if available
            if celery_task:
                celery_task.update_state(
                    state="PROGRESS",
                    meta={
                        "stage": "CREATING_PROFILES",
                        "progress": 20,
                    },
                )

            success = self._run_tracer_command(task, execution, params, output_dir, celery_task)

            if success:
                self._post_process_results(task, execution, output_dir, celery_task)
            else:
                return False

        except ValueError as e:
            # Project configuration errors - user execution error
            logger.info(f"TRACER project configuration error for task {task.id}: {e!s}")
            task.error_message = f"Project configuration error: {e!s}"
            task.save()
            return False
        except OSError as e:
            # File system errors - could be user execution error or system issue
            logger.info(f"TRACER file system error for task {task.id}: {e!s}")
            task.error_message = "File system error occurred. Please check permissions and try again."
            task.save()
            return False
        except (DatabaseError, IntegrityError) as e:
            # Any other unexpected errors - likely Django app errors
            logger.error(f"Unexpected Django error in TRACER execution for task {task.id}: {e!s}")
            task.error_message = "An unexpected error occurred during TRACER execution. Please try again or contact support if the issue persists."
            task.save()
            return False
        else:
            return True

    def _validate_project_configuration(self, project: Project) -> None:
        """Validate that project has required configuration."""
        if not project.chatbot_connector:
            msg = "Project must have a chatbot connector configured"
            raise ValueError(msg)

        if not project.llm_model:
            msg = "Project must have an exploration model configured"
            raise ValueError(msg)

    def _setup_output_directory(self, execution: ProfileExecution) -> Path:
        """Set up and return the output directory for TRACER results."""
        output_dir = Path(settings.MEDIA_ROOT) / execution.profiles_directory
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir

    def _run_tracer_command(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        params: ProfileGenerationParams,
        output_dir: Path,
        celery_task: "Task | None" = None,
    ) -> bool:
        """Execute the TRACER command and handle output."""
        project = task.project
        connector = project.chatbot_connector

        if not connector:
            raise ValueError("Project does not have a chatbot connector configured")

        # Extract technology and parameters from the connector
        technology = connector.technology
        connector_params = self._prepare_connector_params(connector)

        exploration_model = project.llm_model or "gpt-4o-mini"
        profile_model = project.profile_model or None  # None if not set

        cmd = self._build_tracer_command(
            params, technology, connector_params, exploration_model, profile_model, output_dir
        )

        env = self._prepare_environment(params.api_key, project.llm_provider)

        return self._execute_subprocess(task, execution, cmd, env, celery_task)

    def _prepare_connector_params(self, connector: "ChatbotConnector") -> dict[str, Any] | str:
        """Prepare connector parameters based on the technology type."""
        if connector.technology == "custom":
            # For custom connectors, we need to pass the config file path
            if connector.custom_config_file:
                return f"config_path={connector.custom_config_file.path}"
            raise ValueError("Custom connector must have a configuration file")
        # For other connectors, use the JSON parameters
        return connector.parameters or {}

    def _build_tracer_command(
        self,
        params: ProfileGenerationParams,
        technology: str,
        connector_params: dict[str, Any] | str,
        exploration_model: str,
        profile_model: str | None,
        output_dir: Path,
    ) -> list[str]:
        """Build the TRACER command with all parameters."""
        import json

        cmd = [
            "tracer",
            "-s",
            str(params.conversations),
            "-n",
            str(params.turns),
            "--technology",
            technology,
            "--connector-params",
        ]

        # Handle connector_params based on type
        if isinstance(connector_params, str):
            # For custom connectors, connector_params is a string like "config_path=./path"
            cmd.append(connector_params)
        else:
            # For other connectors, connector_params is a dict that should be JSON-encoded
            cmd.append(json.dumps(connector_params))

        cmd.extend(["-m", exploration_model])

        if profile_model:
            cmd.extend(["-pm", profile_model])
        cmd.extend(
            [
                "-o",
                str(output_dir),
                "--graph-format",
                params.graph_format,
            ]
        )

        # Add verbosity flags
        if params.verbosity == "verbose":
            cmd.append("-v")
        elif params.verbosity == "debug":
            cmd.append("-vv")

        logger.info(f"Executing TRACER command: {shlex.join(cmd)}")
        return cmd

    def _prepare_environment(self, api_key: str | None, provider: str) -> dict[str, str]:
        """Prepare environment variables for TRACER execution."""
        env = os.environ.copy()

        if api_key:
            env_var_name = self.get_api_key_env_var(provider)
            env[env_var_name] = api_key
            logger.info(f"Setting {env_var_name} environment variable for provider: {provider}")

        return env

    def _execute_subprocess(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        cmd: list[str],
        env: dict[str, str],
        celery_task: "Task | None" = None,
    ) -> bool:
        """Execute the TRACER subprocess and handle output."""
        try:
            # S603: The command and environment are constructed from trusted, internal variables only
            process = subprocess.Popen(  # noqa: S603
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                bufsize=1,
                universal_newlines=True,
            )

            full_stdout = self._handle_process_output(task, process, celery_task)
            process.wait()

            full_stderr_lines = []
            if process.stderr:
                full_stderr_lines = process.stderr.readlines()

            full_stderr = "".join(full_stderr_lines)

            # Store TRACER output for debugging
            execution.tracer_stdout = "".join(full_stdout)
            execution.tracer_stderr = full_stderr
            update_fields = ["tracer_stdout", "tracer_stderr"]

            if process.returncode != 0:
                # Parse the specific error type from stderr
                error_type = self._parse_tracer_error(full_stderr)
                execution.error_type = error_type
                update_fields.append("error_type")

                # Generate user-friendly error message
                user_friendly_error = self._generate_user_friendly_error_message(error_type)

                # TRACER execution failure - user execution error, log at info level
                logger.info(f"TRACER execution failed for task {task.id} (error_type: {error_type})")
                task.error_message = user_friendly_error
                task.save()

            execution.save(update_fields=update_fields)

            if process.returncode != 0:
                return False

            logger.info(f"TRACER execution successful for task {task.id}")

        except subprocess.SubprocessError as e:
            # TRACER command execution issues - user execution error
            logger.info(f"TRACER subprocess error for task {task.id}: {e!s}")
            task.error_message = (
                "Failed to execute TRACER command. Please ensure TRACER is properly installed and accessible."
            )
            task.save()
            execution.error_type = "SUBPROCESS_ERROR"
            execution.save(update_fields=["error_type"])
            return False
        except OSError as e:
            # System errors - could be user or system issue
            logger.info(f"TRACER system error for task {task.id}: {e!s}")
            task.error_message = "A system error occurred during TRACER execution. Please try again or contact support if the issue persists."
            task.save()
            execution.error_type = "SYSTEM_ERROR"
            execution.save(update_fields=["error_type"])
            return False
        except (DatabaseError, IntegrityError) as e:
            # Unexpected errors - likely Django app errors
            logger.error(f"Unexpected Django error during TRACER subprocess for task {task.id}: {e!s}")
            task.error_message = "An unexpected error occurred during TRACER execution. Please try again or contact support if the issue persists."
            task.save()
            execution.error_type = "OTHER"
            execution.save(update_fields=["error_type"])
            return False
        else:
            return True

    def _parse_tracer_error(self, stderr: str) -> str:
        """Parse TRACER stderr to identify specific exception types.

        Since TRACER runs as a subprocess, we parse the traceback output
        to identify which specific exception was raised.
        """
        if not stderr.strip():
            return "OTHER"

        # Normalize the stderr for consistent parsing
        stderr_lower = stderr.lower()

        # Look for exception class names in the traceback
        # Order matters - check more specific exceptions first
        exception_patterns = [
            # Specific connector errors (check before generic ConnectorError)
            ("connectorauthenticationerror", "CONNECTOR_AUTHENTICATION"),
            ("connectorconfigurationerror", "CONNECTOR_CONFIGURATION"),
            ("connectorconnectionerror", "CONNECTOR_CONNECTION"),
            ("connectorresponseerror", "CONNECTOR_RESPONSE"),
            # General connector error (fallback for connector issues)
            ("connectorerror", "CONNECTOR_ERROR"),
            # Other specific errors
            ("graphviznotinstallederror", "GRAPHVIZ_NOT_INSTALLED"),
            ("llmerror", "LLM_ERROR"),
            # Base TRACER error (most general)
            ("tracererror", "TRACER_ERROR"),
        ]

        for pattern, error_code in exception_patterns:
            if pattern in stderr_lower:
                logger.info(f"Identified TRACER exception: {pattern} -> {error_code}")
                return error_code

        # Check for common error indicators if no specific exception is found
        error_indicators = [
            ("permission denied", "PERMISSION_ERROR"),
            ("connection refused", "CONNECTION_ERROR"),
            ("timeout", "TIMEOUT_ERROR"),
            ("api key", "API_KEY_ERROR"),
            ("authentication", "AUTHENTICATION_ERROR"),
            ("not found", "NOT_FOUND_ERROR"),
        ]

        for indicator, error_code in error_indicators:
            if indicator in stderr_lower:
                logger.info(f"Identified error indicator: {indicator} -> {error_code}")
                return error_code

        # Log the unrecognized error for debugging
        logger.debug(f"Could not categorize TRACER error type from stderr. stderr preview: {stderr[:200]}...")
        return "OTHER"

    def _handle_process_output(
        self, task: ProfileGenerationTask, process: subprocess.Popen, celery_task: "Task | None" = None
    ) -> list[str]:
        """Handle process output and update progress."""
        full_stdout = []

        if process.stdout:
            for line in iter(process.stdout.readline, ""):
                full_stdout.append(line)
                if line.strip():
                    logger.info(f"TRACER (task {task.id}): {line.strip()}")
                    self._update_progress_from_tracer_output(task, line, celery_task)

        return full_stdout

    def _post_process_results(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        output_dir: Path,
        celery_task: "Task | None" = None,
    ) -> None:
        """Post-process TRACER results."""
        task.progress_percentage = 99
        task.stage = "SAVING_FILES"
        task.save()

        # Update Celery task state if available
        if celery_task:
            celery_task.update_state(
                state="PROGRESS",
                meta={
                    "stage": "SAVING_FILES",
                    "progress": 99,
                },
            )

        # Process results with dual storage
        processor = TracerResultsProcessor()
        processor.process_tracer_results_dual_storage(execution, output_dir)

        # Calculate execution time
        execution_time = (datetime.now(UTC) - execution.created_at).seconds // 60
        execution.execution_time_minutes = execution_time
        execution.save()

    def _update_progress_from_tracer_output(
        self, task: ProfileGenerationTask, line: str, celery_task: "Task | None" = None
    ) -> None:
        """Parse a line of TRACER output and update the task progress."""
        try:
            line = line.strip()
            progress_updated = (
                self._handle_exploration_phase(task, line)
                or self._handle_analysis_phase(task, line)
                or self._handle_finalization_phase(task, line)
            )

            if progress_updated:
                task.save(update_fields=["stage", "progress_percentage"])

                # Update Celery task state if available
                if celery_task:
                    celery_task.update_state(
                        state="PROGRESS",
                        meta={
                            "stage": task.stage,
                            "progress": task.progress_percentage,
                        },
                    )
        except (ValueError, AttributeError, TypeError) as e:
            logger.debug(f"Non-critical: Could not parse TRACER progress from output for task {task.id}: {e!s}")

    def _handle_exploration_phase(self, task: ProfileGenerationTask, line: str) -> bool:
        if "Initializing Chatbot Exploration Agent" in line:
            task.stage = "Initializing Agent"
            task.progress_percentage = 5
            return True
        if "--- Starting Chatbot Exploration Phase ---" in line:
            task.stage = "Exploration Phase"
            task.progress_percentage = 10
            return True
        if "=== Starting Exploration Session" in line:
            self._update_exploration_progress(task, line)
            return True
        return False

    def _handle_analysis_phase(self, task: ProfileGenerationTask, line: str) -> bool:
        if "---   Starting Analysis Phase   ---" in line:
            task.stage = "Analysis Phase"
            task.progress_percentage = 55
            return True
        if "Step 1: Workflow structure inference" in line:
            task.stage = "Analyzing: Workflow Inference"
            task.progress_percentage = 65
            return True
        if "Step 2: User profile generation" in line:
            task.stage = "Analyzing: Generating Profiles"
            task.progress_percentage = 75
            return True
        if "Step 3: Conversation parameters generation" in line:
            task.stage = "Analyzing: Generating Conversation Parameters"
            task.progress_percentage = 85
            return True
        if "Step 4: Building user profiles" in line:
            task.stage = "Analyzing: Building Profiles"
            task.progress_percentage = 95
            return True
        return False

    def _handle_finalization_phase(self, task: ProfileGenerationTask, line: str) -> bool:
        if "---   Final Report Summary   ---" in line:
            task.stage = "Finalizing Report"
            task.progress_percentage = 98
            return True
        return False

    def _update_exploration_progress(self, task: ProfileGenerationTask, line: str) -> None:
        """Update progress during exploration phase."""
        match = re.search(r"Exploration Session (\d+)/(\d+)", line)
        if match:
            current_session = int(match.group(1))
            total_sessions_from_log = int(match.group(2))
            task.stage = f"Exploring: Session {current_session}/{total_sessions_from_log}"
            # Exploration is from 10% to 50%
            progress = 10 + int((current_session / total_sessions_from_log) * 40)
            task.progress_percentage = progress

    def _generate_user_friendly_error_message(self, error_type: str) -> str:
        """Generate user-friendly error messages based on the error type.

        Args:
            error_type: The parsed error type code

        Returns:
            A user-friendly error message
        """
        error_messages = {
            "GRAPHVIZ_NOT_INSTALLED": (
                "Graphviz is not installed on the system. Contact the system administrator to install Graphviz on the backend server."
            ),
            "CONNECTOR_CONNECTION": (
                "Unable to connect to the chatbot. Please check the chatbot URL and ensure the service is running."
            ),
            "CONNECTOR_AUTHENTICATION": (
                "Authentication failed with the chatbot. Please verify the API key or authentication credentials."
            ),
            "CONNECTOR_CONFIGURATION": (
                "The chatbot connector is not configured correctly. Please check the connector settings and parameters."
            ),
            "CONNECTOR_RESPONSE": (
                "The chatbot returned an invalid or unexpected response. "
                "This may be a temporary issue with the chatbot service."
            ),
            "LLM_ERROR": (
                "An error occurred with the Language Model API. Please check your API key and model configuration."
            ),
            "CONNECTOR_ERROR": (
                "A general error occurred with the chatbot connector. "
                "Please check the connector configuration and try again."
            ),
            "TRACER_ERROR": (
                "An error occurred during TRACER execution. Please check the configuration and try again."
            ),
            "PERMISSION_ERROR": (
                "Permission denied during TRACER execution. Please check file and directory permissions."
            ),
            "CONNECTION_ERROR": (
                "Network connection error occurred. Please check your internet connection and try again."
            ),
            "TIMEOUT_ERROR": ("Operation timed out. The chatbot or API may be responding slowly. Please try again."),
            "API_KEY_ERROR": ("API key error. Please verify your API key is correct and has sufficient permissions."),
            "AUTHENTICATION_ERROR": ("Authentication error occurred. Please check your credentials and try again."),
            "NOT_FOUND_ERROR": (
                "Required resource not found. Please check the configuration and ensure all dependencies are available."
            ),
            "SUBPROCESS_ERROR": (
                "Failed to execute TRACER command. Please ensure TRACER is properly installed and accessible."
            ),
            "SYSTEM_ERROR": (
                "A system error occurred during execution. Please try again or contact support if the issue persists."
            ),
        }

        user_message = error_messages.get(error_type, "An unknown error occurred during TRACER execution.")

        # For debugging, include the error type in the message
        return f"{user_message} (Error type: {error_type})"

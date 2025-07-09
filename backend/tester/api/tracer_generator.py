"""TRACER profile generation core functionality."""

import os
import re
import shlex
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from django.conf import settings

from tester.api.base import logger
from tester.models import ProfileExecution, ProfileGenerationTask


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
        technology: str,
        conversations: int,
        turns: int,
        verbosity: str,
        _user_id: Any,  # noqa: ANN401
        api_key: str | None,
    ) -> None:
        """Run profile generation asynchronously using real TRACER."""
        task = None
        execution = None

        try:
            task = self._initialize_task(task_id)
            execution = self._create_execution(task, conversations, turns, verbosity)

            success = self.execute_tracer_generation(
                task, execution, technology, conversations, turns, verbosity, api_key
            )

            self._finalize_execution(task, execution, success)

        except Exception as e:  # noqa: BLE001
            logger.error(f"Error in TRACER profile generation for task {task_id}: {e!s}")
            self._handle_execution_error(task, execution, str(e))

    def _initialize_task(self, task_id: int) -> ProfileGenerationTask:
        """Initialize and update task status."""
        task = ProfileGenerationTask.objects.get(id=task_id)
        task.status = "RUNNING"
        task.stage = "INITIALIZING"
        task.save()

        logger.info(f"Starting TRACER profile generation for task {task_id}")
        return task

    def _create_execution(
        self,
        task: ProfileGenerationTask,
        conversations: int,
        turns: int,
        verbosity: str
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
        success: bool
    ) -> None:
        """Finalize task and execution status based on success."""
        if success:
            task.status = "COMPLETED"
            task.progress_percentage = 100
            task.stage = "COMPLETED"
            execution.status = "COMPLETED"
            logger.info(f"TRACER profile generation completed for task {task.id}")
        else:
            task.status = "ERROR"
            task.error_message = "TRACER execution failed"
            execution.status = "ERROR"
            logger.error(f"TRACER profile generation failed for task {task.id}")

        task.save()
        execution.save()

    def _handle_execution_error(
        self,
        task: ProfileGenerationTask | None,
        execution: ProfileExecution | None,
        error_message: str
    ) -> None:
        """Handle errors during execution."""
        if task:
            try:
                task.status = "ERROR"
                task.error_message = error_message
                task.save()
            except Exception as update_exc:  # noqa: BLE001
                logger.critical(
                    f"Failed to update task {task.id} to ERROR status after an error. "
                    f"Initial error: {error_message}. Update error: {update_exc!s}"
                )

        if execution:
            try:
                execution.status = "ERROR"
                execution.save()
            except Exception:  # noqa: BLE001
                logger.critical(f"Failed to update execution {execution.id} to ERROR status")

    def execute_tracer_generation(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        technology: str,
        sessions: int,
        turns_per_session: int,
        verbosity: str,
        api_key: str | None = None,
        graph_format: str = "all",
    ) -> bool:
        """Execute TRACER command and process results."""
        try:
            self._validate_project_configuration(task.project)
            output_dir = self._setup_output_directory(execution)

            # Update progress
            task.progress_percentage = 20
            task.stage = "CREATING_PROFILES"
            task.save()

            success = self._run_tracer_command(
                task, execution, technology, sessions, turns_per_session,
                verbosity, output_dir, graph_format, api_key
            )

            if success:
                self._post_process_results(task, execution, output_dir)

            return success

        except (subprocess.SubprocessError, OSError, ValueError) as e:
            logger.error(f"TRACER execution error: {e!s}")
            task.error_message = f"TRACER execution error: {e!s}"
            task.save()
            return False

    def _validate_project_configuration(self, project) -> None:
        """Validate that project has required configuration."""
        if not project.chatbot_connector:
            raise ValueError("Project must have a chatbot connector configured")

        if not project.llm_model:
            raise ValueError("Project must have an LLM model configured")

    def _setup_output_directory(self, execution: ProfileExecution) -> Path:
        """Set up and return the output directory for TRACER results."""
        output_dir = Path(settings.MEDIA_ROOT) / execution.profiles_directory
        output_dir.mkdir(parents=True, exist_ok=True)
        return output_dir

    def _run_tracer_command(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        technology: str,
        sessions: int,
        turns_per_session: int,
        verbosity: str,
        output_dir: Path,
        graph_format: str,
        api_key: str | None,
    ) -> bool:
        """Execute the TRACER command and handle output."""
        project = task.project
        chatbot_url = project.chatbot_connector.link if project.chatbot_connector else "http://localhost:5000"
        model = project.llm_model or "gpt-4o-mini"

        cmd = self._build_tracer_command(
            sessions, turns_per_session, technology, chatbot_url,
            model, output_dir, graph_format, verbosity
        )

        env = self._prepare_environment(api_key, project.llm_provider)

        return self._execute_subprocess(task, execution, cmd, env)

    def _build_tracer_command(
        self,
        sessions: int,
        turns_per_session: int,
        technology: str,
        chatbot_url: str,
        model: str,
        output_dir: Path,
        graph_format: str,
        verbosity: str,
    ) -> list[str]:
        """Build the TRACER command with all parameters."""
        cmd = [
            "tracer",
            "-s", str(sessions),
            "-n", str(turns_per_session),
            "-t", technology,
            "-u", chatbot_url,
            "-m", model,
            "-o", str(output_dir),
            "--graph-format", graph_format,
        ]

        # Add verbosity flags
        if verbosity == "verbose":
            cmd.append("-v")
        elif verbosity == "debug":
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
        env: dict[str, str]
    ) -> bool:
        """Execute the TRACER subprocess and handle output."""
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            bufsize=1,
            universal_newlines=True,
        )

        full_stdout = self._handle_process_output(task, process)
        process.wait()

        full_stderr = []
        if process.stderr:
            full_stderr = process.stderr.readlines()

        # Store TRACER output for debugging
        execution.tracer_stdout = "".join(full_stdout)
        execution.tracer_stderr = "".join(full_stderr)
        execution.save(update_fields=["tracer_stdout", "tracer_stderr"])

        if process.returncode != 0:
            logger.error(f"TRACER execution failed: {''.join(full_stderr)}")
            task.error_message = f"TRACER failed: {''.join(full_stderr)}"
            task.save()
            return False

        logger.info(f"TRACER execution successful for task {task.id}")
        return True

    def _handle_process_output(
        self,
        task: ProfileGenerationTask,
        process: subprocess.Popen
    ) -> list[str]:
        """Handle process output and update progress."""
        full_stdout = []

        if process.stdout:
            for line in iter(process.stdout.readline, ""):
                full_stdout.append(line)
                if line.strip():
                    logger.info(f"TRACER (task {task.id}): {line.strip()}")
                    self._update_progress_from_tracer_output(task, line)

        return full_stdout

    def _post_process_results(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        output_dir: Path
    ) -> None:
        """Post-process TRACER results."""
        # Import here to avoid circular imports
        from tester.api.tracer_parser import TracerResultsProcessor

        task.progress_percentage = 99
        task.stage = "SAVING_FILES"
        task.save()

        # Process results with dual storage
        processor = TracerResultsProcessor()
        processor.process_tracer_results_dual_storage(execution, output_dir)

        # Calculate execution time
        execution_time = (datetime.now(UTC) - execution.created_at).seconds // 60
        execution.execution_time_minutes = execution_time
        execution.save()

    def _update_progress_from_tracer_output(self, task: ProfileGenerationTask, line: str) -> None:
        """Parse a line of TRACER output and update the task progress."""
        try:
            line = line.strip()

            # Exploration Phase
            if "Initializing Chatbot Exploration Agent" in line:
                task.stage = "Initializing Agent"
                task.progress_percentage = 5
            elif "--- Starting Chatbot Exploration Phase ---" in line:
                task.stage = "Exploration Phase"
                task.progress_percentage = 10
            elif "=== Starting Exploration Session" in line:
                self._update_exploration_progress(task, line)
            # Analysis Phase
            elif "---   Starting Analysis Phase   ---" in line:
                task.stage = "Analysis Phase"
                task.progress_percentage = 55
            elif "Step 1: Workflow structure inference" in line:
                task.stage = "Analyzing: Workflow Inference"
                task.progress_percentage = 65
            elif "Step 2: User profile generation" in line:
                task.stage = "Analyzing: Generating Profiles"
                task.progress_percentage = 75
            elif "Step 3: Conversation parameters generation" in line:
                task.stage = "Analyzing: Generating Conversation Parameters"
                task.progress_percentage = 85
            elif "Step 4: Building user profiles" in line:
                task.stage = "Analyzing: Building Profiles"
                task.progress_percentage = 95
            # Finalization
            elif "---   Final Report Summary   ---" in line:
                task.stage = "Finalizing Report"
                task.progress_percentage = 98

            task.save(update_fields=["stage", "progress_percentage"])

        except Exception as e:
            logger.warning(f"Error updating progress from TRACER output: {e!s}")

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

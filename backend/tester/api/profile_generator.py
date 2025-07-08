"""Profile generation functionality."""

import json
import os
import re
import shlex
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from django.conf import settings

from tester.api.base import logger
from tester.models import (
    OriginalTracerProfile,
    ProfileExecution,
    ProfileGenerationTask,
    TestFile,
    TracerAnalysisResult,
)


class ProfileGenerator:
    """Handles user profile generation tasks with real TRACER integration."""

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
            task = ProfileGenerationTask.objects.get(id=task_id)
            task.status = "RUNNING"
            task.stage = "INITIALIZING"
            task.save()

            logger.info(f"Starting TRACER profile generation for task {task_id}")
            logger.info(f"Technology: {technology}, Sessions: {conversations}, Turns: {turns}, Verbosity: {verbosity}")

            # Create execution record
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

            # Link task to execution
            task.execution = execution
            task.save()

            # Update progress
            task.progress_percentage = 10
            task.stage = "GENERATING_CONVERSATIONS"
            task.save()

            # Run TRACER generation
            success = self.run_tracer_generation(
                task, execution, technology, conversations, turns, verbosity, "all", api_key
            )

            if success:
                task.status = "COMPLETED"
                task.progress_percentage = 100
                task.stage = "COMPLETED"
                execution.status = "COMPLETED"
                logger.info(f"TRACER profile generation completed for task {task_id}")
            else:
                task.status = "ERROR"
                task.error_message = "TRACER execution failed"
                execution.status = "ERROR"
                logger.error(f"TRACER profile generation failed for task {task_id}")

            task.save()
            execution.save()

        except Exception as e:  # noqa: BLE001
            logger.error(f"Error in TRACER profile generation for task {task_id}: {e!s}")
            if task:
                try:
                    task.status = "ERROR"
                    task.error_message = str(e)
                    task.save()
                except Exception as update_exc:  # noqa: BLE001
                    logger.critical(
                        f"Failed to update task {task_id} to ERROR status after an error. "
                        f"Initial error: {e!s}. Update error: {update_exc!s}"
                    )
            if execution:
                try:
                    execution.status = "ERROR"
                    execution.save()
                except Exception:  # noqa: BLE001
                    logger.critical(f"Failed to update execution {execution.id} to ERROR status")

    def run_tracer_generation(
        self,
        task: ProfileGenerationTask,
        execution: ProfileExecution,
        technology: str,
        sessions: int,
        turns_per_session: int,
        verbosity: str,
        graph_format: str = "all",  # Ask TRACER to generate all available formats in one go
        api_key: str | None = None,
    ) -> bool:
        """Execute TRACER command and process results with dual storage."""
        try:
            # Validate project configuration
            project = task.project
            if not project.chatbot_connector:
                error_message = "Project must have a chatbot connector configured"
                raise ValueError(error_message)

            if not project.llm_model:
                error_message = "Project must have an LLM model configured"
                raise ValueError(error_message)

            # Set up output directory
            output_dir = Path(settings.MEDIA_ROOT) / execution.profiles_directory
            output_dir.mkdir(parents=True, exist_ok=True)

            # Update progress
            task.progress_percentage = 20
            task.stage = "CREATING_PROFILES"
            task.save()

            # Get project configuration
            chatbot_url = project.chatbot_connector.link if project.chatbot_connector else "http://localhost:5000"
            model = project.llm_model or "gpt-4o-mini"

            # Build TRACER command – we generate all graph formats in a single run
            cmd = [
                "tracer",
                "-s",
                str(sessions),
                "-n",
                str(turns_per_session),
                "-t",
                technology,
                "-u",
                chatbot_url,
                "-m",
                model,
                "-o",
                str(output_dir),
                "--graph-format",
                graph_format,
            ]

            # Add verbosity flags
            if verbosity == "verbose":
                cmd.append("-v")
            elif verbosity == "debug":
                cmd.append("-vv")

            logger.info(f"Executing TRACER command: {shlex.join(cmd)}")

            # Prepare environment for subprocess
            env = os.environ.copy()
            if api_key:
                # Get the provider from the project's API key
                provider = task.project.llm_provider
                env_var_name = self._get_api_key_env_var(provider)
                env[env_var_name] = api_key
                logger.info(f"Setting {env_var_name} environment variable for provider: {provider}")

            # Execute TRACER
            result = subprocess.run(cmd, check=False, capture_output=True, text=True, env=env)  # noqa: S603

            # Store TRACER output for debugging
            execution.tracer_stdout = result.stdout
            execution.tracer_stderr = result.stderr
            execution.save(update_fields=["tracer_stdout", "tracer_stderr"])

            if result.returncode != 0:
                logger.error(f"TRACER execution failed: {result.stderr}")
                task.error_message = f"TRACER failed: {result.stderr}"
                task.save()
                return False

            # Success path
            logger.info(f"TRACER execution successful for task {task.id}")

            # Update progress
            task.progress_percentage = 80
            task.stage = "SAVING_FILES"
            task.save()

            # Process results with dual storage (auto-detect generated formats)
            self.process_tracer_results_dual_storage(execution, output_dir)

            # Calculate execution time
            execution_time = (datetime.now(UTC) - execution.created_at).seconds // 60
            execution.execution_time_minutes = execution_time
            execution.save()

            return True

        except (subprocess.SubprocessError, OSError) as e:
            logger.error(f"TRACER execution error: {e!s}")
            task.error_message = f"TRACER execution error: {e!s}"
            task.save()
            return False

        else:
            return True

    def process_tracer_results_dual_storage(self, execution: ProfileExecution, output_dir: Path) -> None:
        """Process TRACER results with dual storage: editable + read-only originals.

        TRACER (invoked with --graph-format all) creates workflow_graph.svg/png/pdf in the output
        directory.  We move whichever ones exist into the analysis directory and record their
        paths in TracerAnalysisResult so the frontend dropdown shows only available formats.
        """
        # Create directory structure
        profiles_dir = output_dir / "profiles"
        originals_dir = output_dir / "originals"
        analysis_dir = output_dir / "analysis"

        originals_dir.mkdir(exist_ok=True)
        analysis_dir.mkdir(exist_ok=True)

        # Create editable profiles directory for TestFiles
        project = execution.project
        user_id = project.owner.id
        project_id = project.id
        editable_profiles_dir = (
            Path(settings.MEDIA_ROOT) / "projects" / f"user_{user_id}" / f"project_{project_id}" / "profiles"
        )
        editable_profiles_dir.mkdir(parents=True, exist_ok=True)

        profile_count = 0

        # Process each generated profile
        if profiles_dir.exists():
            for yaml_file in profiles_dir.glob("*.yaml"):
                # Read original content
                with yaml_file.open("r", encoding="utf-8") as f:
                    original_content = f.read()

                # Store read-only original for TRACER dashboard
                OriginalTracerProfile.objects.create(
                    execution=execution, original_filename=yaml_file.name, original_content=original_content
                )

                # Copy original to originals directory
                shutil.copy(yaml_file, originals_dir / yaml_file.name)

                # Create editable copy for TestFile
                editable_file_path = editable_profiles_dir / yaml_file.name
                shutil.copy(yaml_file, editable_file_path)

                # Create TestFile with proper file reference
                relative_path = f"projects/user_{user_id}/project_{project_id}/profiles/{yaml_file.name}"
                test_file = TestFile(project=project, execution=execution)
                test_file.file.name = relative_path
                test_file.save()

                profile_count += 1

        # Update execution with profile count
        execution.generated_profiles_count = profile_count
        execution.save()

        # Move analysis files – README.md or report.txt plus any workflow_graph.<ext> that exist
        readme_path = output_dir / "README.md"
        report_txt_path = output_dir / "report.txt"

        final_report_path = None
        final_graph_paths: dict[str, str] = {}

        # Handle possible graph formats generated by TRACER
        for ext in ("svg", "png", "pdf"):
            candidate = output_dir / f"workflow_graph.{ext}"
            if candidate.exists():
                dest = analysis_dir / f"workflow_graph.{ext}"
                shutil.move(candidate, dest)
                # Store path relative to MEDIA_ROOT so it can be safely joined with MEDIA_URL later
                final_graph_paths[ext] = str(dest.relative_to(Path(settings.MEDIA_ROOT)))
                logger.info(f"Moved workflow_graph.{ext} to {dest}")

        # Parse metadata from report (prioritize report.txt, fall back to README.md)
        report_metadata = {}
        report_source_path = None

        if report_txt_path.exists():
            report_source_path = report_txt_path
            logger.info(f"Found report.txt, parsing metadata from: {report_txt_path}")
        elif readme_path.exists():
            report_source_path = readme_path
            logger.info(f"Found README.md, parsing metadata from: {readme_path}")

        if report_source_path:
            report_metadata = self._parse_report_metadata(report_source_path)
            # Move the report file to the analysis directory
            final_report_dest = analysis_dir / "report.md"
            shutil.move(report_source_path, final_report_dest)
            # Use relative path for storage
            final_report_path = str(final_report_dest.relative_to(Path(settings.MEDIA_ROOT)))

        # Create analysis result record
        TracerAnalysisResult.objects.create(
            execution=execution,
            report_file_path=final_report_path or "",
            workflow_graph_svg_path=final_graph_paths.get("svg", ""),
            workflow_graph_png_path=final_graph_paths.get("png", ""),
            workflow_graph_pdf_path=final_graph_paths.get("pdf", ""),
            total_interactions=report_metadata.get("total_interactions", 0),
            unique_paths_discovered=report_metadata.get("unique_paths", 0),
            categories_count=report_metadata.get("categories_count", 0),
            estimated_cost_usd=report_metadata.get("estimated_cost_usd", 0.0),
        )

        logger.info(f"Processed {profile_count} profiles for execution {execution.execution_name}")

    def _parse_report_metadata(self, report_path: Path) -> dict[str, int]:
        """Parse TRACER report files to extract metadata."""
        metadata = {"total_interactions": 0, "unique_paths": 0, "categories_count": 0, "estimated_cost_usd": 0.0}

        try:
            # First try to parse functionalities.json if it exists (structured data)
            json_path = report_path.parent / "functionalities.json"
            if json_path.exists():
                metadata.update(self._parse_functionalities_json(json_path))

            # Parse the report for performance statistics
            with report_path.open("r", encoding="utf-8") as f:
                content = f.read()

            # Determine if this is a .txt or .md file to use appropriate parsing logic
            is_txt_format = report_path.suffix.lower() == ".txt" or "=== CHATBOT FUNCTIONALITY ANALYSIS ===" in content

            if is_txt_format:
                # Parse .txt format (newer TRACER reports)
                metadata.update(self._parse_txt_format(content))
            else:
                # Parse .md format (older TRACER reports)
                metadata.update(self._parse_md_format(content))

            logger.info(f"Parsed TRACER report metadata: {metadata}")

        except (OSError, ValueError) as e:
            logger.warning(f"Could not parse TRACER report metadata: {e!s}")

        return metadata

    def _parse_txt_format(self, content: str) -> dict[str, int]:
        """Parse .txt format TRACER reports."""
        metadata = {}
        lines = content.split("\n")

        # Count categories by finding "### CATEGORY:" lines
        category_lines = [line for line in lines if line.strip().startswith("### CATEGORY:")]
        if category_lines:
            metadata["categories_count"] = len(category_lines)

        # Count functionalities from the category sections
        # Look for lines like "### CATEGORY: Appointment Management (5 functions)"
        total_functions = 0
        for line in lines:
            if line.strip().startswith("### CATEGORY:") and "(" in line and "functions)" in line:
                try:
                    # Extract number of functions from pattern like "(5 functions)"
                    match = re.search(r"\((\d+)\s+functions?\)", line)
                    if match:
                        total_functions += int(match.group(1))
                except (ValueError, AttributeError):
                    pass

        if total_functions > 0:
            metadata["unique_paths"] = total_functions

        # Parse token usage statistics
        for line in lines:
            line = line.strip()

            # Look for total LLM calls in TOTAL TOKEN CONSUMPTION section
            if "Total LLM calls:" in line:
                try:
                    # Format: "Total LLM calls:     2,479"
                    parts = line.split(":")
                    if len(parts) >= 2:
                        calls_str = parts[1].strip().replace(",", "")
                        if calls_str.isdigit():
                            metadata["total_interactions"] = int(calls_str)
                except (ValueError, IndexError):
                    pass

            # Look for estimated cost in TOTAL TOKEN CONSUMPTION section
            elif "Estimated cost:" in line and "USD" in line:
                try:
                    # Format: "Estimated cost:      $0.1602 USD"
                    cost_match = re.search(r"Estimated cost:\s*\$([0-9]+\.?[0-9]*)\s*USD", line)
                    if cost_match:
                        cost_value = float(cost_match.group(1))
                        # Only update if this is in the TOTAL section (usually the last/largest one)
                        if cost_value > metadata.get("estimated_cost_usd", 0.0):
                            metadata["estimated_cost_usd"] = cost_value
                except (ValueError, AttributeError):
                    pass

        return metadata

    def _parse_md_format(self, content: str) -> dict[str, int]:
        """Parse .md format TRACER reports (legacy)."""
        metadata = {}
        lines = content.split("\n")

        # Look for "X functionalities discovered" pattern and categories count
        for raw_line in lines:
            line = raw_line.strip()

            # Search for pattern like: "**6 functionalities** discovered across **3 categories**"
            if "functionalities** discovered" in line and "categories**" in line:
                try:
                    # Extract the number before "functionalities"
                    func_match = re.search(r"\*\*(\d+)\s+functionalities\*\*", line)
                    if func_match:
                        metadata["unique_paths"] = int(func_match.group(1))

                    # Extract the number before "categories"
                    cat_match = re.search(r"across \*\*(\d+)\s+categories\*\*", line)
                    if cat_match:
                        metadata["categories_count"] = int(cat_match.group(1))
                except (ValueError, AttributeError):
                    pass

            # Fallback: Search for just functionalities count if the combined pattern didn't match
            elif "functionalities** discovered" in line and metadata.get("unique_paths", 0) == 0:
                try:
                    match = re.search(r"\*\*(\d+)\s+functionalities\*\*", line)
                    if match:
                        metadata["unique_paths"] = int(match.group(1))
                except (ValueError, AttributeError):
                    pass

            # Look for Performance Statistics table values
            elif "Total LLM Calls" in line and "|" in line:
                try:
                    # Format: | Total LLM Calls | 76 |
                    parts = [part.strip() for part in line.split("|")]
                    min_markdown_table_columns = 3
                    if len(parts) >= min_markdown_table_columns and parts[2].isdigit():
                        metadata["total_interactions"] = int(parts[2])
                except (ValueError, IndexError):
                    pass

            # Look for estimated cost in table format
            elif "Estimated Cost" in line and "|" in line and "USD" in line:
                try:
                    # Format: | Estimated Cost | $0.0368 USD |
                    parts = [part.strip() for part in line.split("|")]
                    min_markdown_table_columns = 3
                    if len(parts) >= min_markdown_table_columns:
                        cost_cell = parts[2]  # The value cell
                        cost_match = re.search(r"\$([0-9]*\.?[0-9]+)\s*USD", cost_cell)
                        if cost_match:
                            cost_value = float(cost_match.group(1))
                            metadata["estimated_cost_usd"] = cost_value
                        else:
                            # Fallback: remove '$' and 'USD' and try to convert directly
                            try:
                                clean_cost = cost_cell.replace("$", "").replace("USD", "").strip()
                                metadata["estimated_cost_usd"] = float(clean_cost)
                            except ValueError:
                                pass
                except (ValueError, AttributeError, IndexError):
                    pass

            # Look for total estimated cost in non-table format (backup)
            elif "Estimated cost:" in line and "USD" in line:
                try:
                    # Format: Estimated cost:      $0.1602 USD
                    cost_match = re.search(r"Estimated cost:\s*\$([0-9]+\.?[0-9]*)\s*USD", line)
                    if cost_match:
                        cost_value = float(cost_match.group(1))
                        # Only update if this is the total cost (usually the last/largest one)
                        if cost_value > metadata.get("estimated_cost_usd", 0.0):
                            metadata["estimated_cost_usd"] = cost_value
                except (ValueError, AttributeError):
                    pass

        # Alternative approach: Count categories from "FUNCTIONALITIES (By Category)" section
        if metadata.get("categories_count", 0) == 0:
            category_section_match = re.search(r"## FUNCTIONALITIES \(By Category\)(.*?)(?=##|$)", content, re.DOTALL)
            if category_section_match:
                category_section = category_section_match.group(1)
                # Count lines that start with "### CATEGORY:"
                category_lines = [
                    line for line in category_section.split("\n") if line.strip().startswith("### CATEGORY:")
                ]
                metadata["categories_count"] = len(category_lines)

        return metadata

    def _parse_functionalities_json(self, json_path: Path) -> dict[str, int]:
        """Parse functionalities.json for structured metadata."""
        metadata = {}
        try:
            with json_path.open("r", encoding="utf-8") as f:
                data = json.load(f)

            # Extract relevant metrics from JSON structure
            if (
                isinstance(data, dict)
                and "functionalities" in data
                and isinstance(data["functionalities"], (list, dict))
            ):
                metadata["unique_paths"] = len(data["functionalities"])

            # Look for interaction/call counts
            if "statistics" in data and isinstance(data.get("statistics"), dict):
                stats = data["statistics"]
                if "total_calls" in stats:
                    metadata["total_interactions"] = stats["total_calls"]
                elif "total_llm_calls" in stats:
                    metadata["total_interactions"] = stats["total_llm_calls"]

            logger.info(f"Parsed functionalities.json: {metadata}")

        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Could not parse functionalities.json: {e!s}")

        return metadata

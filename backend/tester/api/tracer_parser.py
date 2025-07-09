"""TRACER result processing and report parsing functionality."""

import json
import re
import shutil
from pathlib import Path

from django.conf import settings

from tester.api.base import logger
from tester.models import (
    OriginalTracerProfile,
    ProfileExecution,
    TestFile,
    TracerAnalysisResult,
)


class TracerResultsProcessor:
    """Handles processing of TRACER execution results and report parsing."""

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
        editable_profiles_dir = self._create_editable_profiles_directory(execution)
        profile_count = self._process_profile_files(execution, profiles_dir, originals_dir, editable_profiles_dir)

        # Update execution with profile count
        execution.generated_profiles_count = profile_count
        execution.save()

        # Process analysis files and create analysis result
        self._process_analysis_files(execution, output_dir, analysis_dir)

        logger.info(f"Processed {profile_count} profiles for execution {execution.execution_name}")

    def _create_editable_profiles_directory(self, execution: ProfileExecution) -> Path:
        """Create the editable profiles directory structure."""
        project = execution.project
        user_id = project.owner.id
        project_id = project.id

        editable_profiles_dir = (
            Path(settings.MEDIA_ROOT) / "projects" / f"user_{user_id}" / f"project_{project_id}" / "profiles"
        )
        editable_profiles_dir.mkdir(parents=True, exist_ok=True)
        return editable_profiles_dir

    def _process_profile_files(
        self,
        execution: ProfileExecution,
        profiles_dir: Path,
        originals_dir: Path,
        editable_profiles_dir: Path,
    ) -> int:
        """Process each generated profile file and return count."""
        profile_count = 0

        if not profiles_dir.exists():
            return profile_count

        for yaml_file in profiles_dir.glob("*.yaml"):
            self._process_single_profile(execution, yaml_file, originals_dir, editable_profiles_dir)
            profile_count += 1

        return profile_count

    def _process_single_profile(
        self,
        execution: ProfileExecution,
        yaml_file: Path,
        originals_dir: Path,
        editable_profiles_dir: Path,
    ) -> None:
        """Process a single profile file."""
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
        self._create_editable_test_file(execution, yaml_file, editable_profiles_dir)

    def _create_editable_test_file(
        self,
        execution: ProfileExecution,
        yaml_file: Path,
        editable_profiles_dir: Path,
    ) -> None:
        """Create an editable TestFile from the profile."""
        project = execution.project
        user_id = project.owner.id
        project_id = project.id

        # Copy to editable location
        editable_file_path = editable_profiles_dir / yaml_file.name
        shutil.copy(yaml_file, editable_file_path)

        # Create TestFile with proper file reference
        relative_path = f"projects/user_{user_id}/project_{project_id}/profiles/{yaml_file.name}"
        test_file = TestFile(project=project, execution=execution)
        test_file.file.name = relative_path
        test_file.save()

    def _process_analysis_files(
        self,
        execution: ProfileExecution,
        output_dir: Path,
        analysis_dir: Path,
    ) -> None:
        """Process analysis files and create TracerAnalysisResult."""
        # Move workflow graphs
        final_graph_paths = self._move_workflow_graphs(output_dir, analysis_dir)

        # Process report files
        final_report_path, report_metadata = self._process_report_files(output_dir, analysis_dir)

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

    def _move_workflow_graphs(self, output_dir: Path, analysis_dir: Path) -> dict[str, str]:
        """Move workflow graph files and return their paths."""
        final_graph_paths: dict[str, str] = {}

        # Handle possible graph formats generated by TRACER
        for ext in ("svg", "png", "pdf"):
            candidate = output_dir / f"workflow_graph.{ext}"
            if candidate.exists():
                dest = analysis_dir / f"workflow_graph.{ext}"
                shutil.move(candidate, dest)
                # Store path relative to MEDIA_ROOT
                final_graph_paths[ext] = str(dest.relative_to(Path(settings.MEDIA_ROOT)))
                logger.info(f"Moved workflow_graph.{ext} to {dest}")

        return final_graph_paths

    def _process_report_files(self, output_dir: Path, analysis_dir: Path) -> tuple[str | None, dict[str, int]]:
        """Process report files and return final path and metadata."""
        readme_path = output_dir / "README.md"
        report_txt_path = output_dir / "report.txt"

        final_report_path = None
        report_metadata = {}
        report_source_path = None

        # Prioritize report.txt, fall back to README.md
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

        return final_report_path, report_metadata


class TracerReportParser:
    """Handles parsing of TRACER report files to extract metadata."""

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
        total_functions = self._count_functionalities_from_categories(lines)
        if total_functions > 0:
            metadata["unique_paths"] = total_functions

        # Parse token usage statistics
        self._parse_token_statistics_txt(lines, metadata)

        return metadata

    def _count_functionalities_from_categories(self, lines: list[str]) -> int:
        """Count functionalities from category sections in txt format."""
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

        return total_functions

    def _parse_token_statistics_txt(self, lines: list[str], metadata: dict) -> None:
        """Parse token usage statistics from txt format."""
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

    def _parse_md_format(self, content: str) -> dict[str, int]:
        """Parse .md format TRACER reports (legacy)."""
        metadata = {}
        lines = content.split("\n")

        # Look for "X functionalities discovered" pattern and categories count
        self._parse_functionality_counts_md(lines, metadata)

        # Look for Performance Statistics table values
        self._parse_performance_statistics_md(lines, metadata)

        # Alternative approach: Count categories from "FUNCTIONALITIES (By Category)" section
        if metadata.get("categories_count", 0) == 0:
            self._count_categories_from_section(content, metadata)

        return metadata

    def _parse_functionality_counts_md(self, lines: list[str], metadata: dict) -> None:
        """Parse functionality counts from md format."""
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

    def _parse_performance_statistics_md(self, lines: list[str], metadata: dict) -> None:
        """Parse performance statistics from md format."""
        for line in lines:
            line = line.strip()

            # Look for Performance Statistics table values
            if "Total LLM Calls" in line and "|" in line:
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
                self._parse_cost_from_table(line, metadata)

            # Look for total estimated cost in non-table format (backup)
            elif "Estimated cost:" in line and "USD" in line:
                self._parse_cost_from_text(line, metadata)

    def _parse_cost_from_table(self, line: str, metadata: dict) -> None:
        """Parse cost from markdown table format."""
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

    def _parse_cost_from_text(self, line: str, metadata: dict) -> None:
        """Parse cost from text format."""
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

    def _count_categories_from_section(self, content: str, metadata: dict) -> None:
        """Count categories from FUNCTIONALITIES section."""
        category_section_match = re.search(r"## FUNCTIONALITIES \(By Category\)(.*?)(?=##|$)", content, re.DOTALL)
        if category_section_match:
            category_section = category_section_match.group(1)
            # Count lines that start with "### CATEGORY:"
            category_lines = [line for line in category_section.split("\n") if line.strip().startswith("### CATEGORY:")]
            metadata["categories_count"] = len(category_lines)

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


# Add the parsing method to TracerResultsProcessor
TracerResultsProcessor._parse_report_metadata = TracerReportParser()._parse_report_metadata

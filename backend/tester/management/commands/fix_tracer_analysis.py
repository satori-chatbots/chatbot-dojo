"""Django management command to fix missing TracerAnalysisResult records."""

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from tester.models import ProfileExecution, TracerAnalysisResult


class Command(BaseCommand):
    """Fix missing TracerAnalysisResult records for existing TRACER executions."""

    help = "Fix missing TracerAnalysisResult records for existing TRACER executions"

    def handle(self, *args, **options):
        """Handle the command execution."""
        self.stdout.write(self.style.SUCCESS("Checking TRACER executions..."))

        # Get all TRACER executions
        tracer_executions = ProfileExecution.objects.filter(execution_type="tracer")
        self.stdout.write(f"Found {tracer_executions.count()} TRACER executions")

        fixed_count = 0
        updated_count = 0

        # Check each execution for missing analysis records
        for execution in tracer_executions:
            has_analysis = hasattr(execution, "analysis_result")
            self.stdout.write(f"Execution {execution.execution_name}: has_analysis={has_analysis}")

            # Check if analysis files exist on disk
            analysis_dir = Path(settings.MEDIA_ROOT) / execution.profiles_directory / "analysis"
            report_path = analysis_dir / "report.md"
            graph_path = analysis_dir / "workflow_graph.pdf"

            report_exists = report_path.exists()
            graph_exists = graph_path.exists()

            self.stdout.write(f"  - Report exists on disk: {report_exists}")
            self.stdout.write(f"  - Graph exists on disk: {graph_exists}")

            if not has_analysis:
                # Create new analysis record if files exist
                if report_exists or graph_exists:
                    relative_report_path = f"{execution.profiles_directory}/analysis/report.md" if report_exists else ""
                    relative_graph_path = (
                        f"{execution.profiles_directory}/analysis/workflow_graph.pdf" if graph_exists else ""
                    )

                    analysis_result = TracerAnalysisResult.objects.create(
                        execution=execution,
                        report_file_path=relative_report_path,
                        workflow_graph_path=relative_graph_path,
                        total_interactions=0,
                        unique_paths_discovered=0,
                    )

                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Created TracerAnalysisResult record: {analysis_result.id}")
                    )
                    fixed_count += 1
                else:
                    self.stdout.write(self.style.WARNING("  - No analysis files found on disk"))
            else:
                # Update existing analysis record if file paths are missing but files exist
                analysis = execution.analysis_result
                needs_update = False

                # Check if we need to update file paths
                if report_exists and not analysis.report_file_path:
                    analysis.report_file_path = f"{execution.profiles_directory}/analysis/report.md"
                    needs_update = True
                    self.stdout.write("  ✓ Updated report file path")

                if graph_exists and not analysis.workflow_graph_path:
                    analysis.workflow_graph_path = f"{execution.profiles_directory}/analysis/workflow_graph.pdf"
                    needs_update = True
                    self.stdout.write("  ✓ Updated graph file path")

                if needs_update:
                    analysis.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Updated existing TracerAnalysisResult record: {analysis.id}")
                    )

        # Verify the results
        self.stdout.write(self.style.SUCCESS("\nVerification:"))
        for execution in tracer_executions:
            if hasattr(execution, "analysis_result"):
                analysis = execution.analysis_result
                report_status = "✓" if analysis.report_file_path else "✗"
                graph_status = "✓" if analysis.workflow_graph_path else "✗"
                self.stdout.write(f"{execution.execution_name}: Report={report_status}, Graph={graph_status}")
            else:
                self.stdout.write(f"{execution.execution_name}: No analysis record")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nFixed {fixed_count} new analysis records and updated {updated_count} existing records!"
            )
        )

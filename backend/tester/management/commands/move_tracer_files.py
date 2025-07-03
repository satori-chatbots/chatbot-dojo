"""Django management command to move TRACER analysis files to analysis directories."""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from tester.models import ProfileExecution


class Command(BaseCommand):
    """Move TRACER analysis files to analysis directories."""

    help = "Move TRACER analysis files (README.md, workflow_graph.pdf, functionalities.json) to analysis directories"

    def handle(self, *args, **options):
        """Handle the command execution."""
        self.stdout.write(self.style.SUCCESS("Moving TRACER analysis files..."))

        # Get all TRACER executions
        tracer_executions = ProfileExecution.objects.filter(execution_type="tracer")
        self.stdout.write(f"Found {tracer_executions.count()} TRACER executions")

        moved_count = 0

        for execution in tracer_executions:
            self.stdout.write(f"\nProcessing {execution.execution_name}:")

            # Get execution directory
            execution_dir = Path(settings.MEDIA_ROOT) / execution.profiles_directory
            analysis_dir = execution_dir / "analysis"

            # Ensure analysis directory exists
            analysis_dir.mkdir(exist_ok=True)

            # Files to move
            files_to_move = [
                ("README.md", "report.md"),  # (source_name, target_name)
                ("workflow_graph.pdf", "workflow_graph.pdf"),
                ("functionalities.json", "functionalities.json"),
            ]

            execution_moved = False

            for source_name, target_name in files_to_move:
                source_path = execution_dir / source_name
                target_path = analysis_dir / target_name

                if source_path.exists():
                    if not target_path.exists():
                        # Move the file
                        shutil.move(str(source_path), str(target_path))
                        self.stdout.write(f"  ✓ Moved {source_name} to analysis/{target_name}")
                        execution_moved = True
                    else:
                        self.stdout.write(f"  - {target_name} already exists in analysis/")
                else:
                    self.stdout.write(f"  - {source_name} not found")

            if execution_moved:
                moved_count += 1
            else:
                self.stdout.write("  - No files to move")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nProcessed {tracer_executions.count()} executions, moved files for {moved_count} of them."
            )
        )

        # Now suggest running the fix script
        self.stdout.write(self.style.WARNING("\nNow run: python manage.py fix_tracer_analysis"))

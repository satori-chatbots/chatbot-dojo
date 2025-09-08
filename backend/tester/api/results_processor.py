"""Results processing and report generation functionality."""

from pathlib import Path
from typing import Any

import yaml

from tester.models import Conversation, GlobalReport, ProfileReport, TestCase, TestError

from .base import logger


class ResultsProcessor:
    """Handles processing of test results and creation of database reports."""

    def process_test_results(self, test_case: TestCase, results_path: str) -> None:
        """Process test results and create reports."""
        try:
            logger.info(f"Processing results for test case {test_case.id}")

            # NEW PATH: reports are now in reports/__stats_reports__
            report_path = Path(results_path) / "reports" / "__stats_reports__"
            if not report_path.exists():
                test_case.status = "FAILURE"
                test_case.error_message = "Error accessing __stats_reports__ directory"
                test_case.save()
                return

            report_file = None
            try:
                for file in report_path.iterdir():
                    if file.name.startswith("report_") and file.name.endswith(".yml"):
                        report_file = file.name
                        break
            except OSError:
                test_case.status = "FAILURE"
                test_case.error_message = "Error accessing report directory"
                test_case.save()
                return

            if report_file is None:
                test_case.status = "FAILURE"
                test_case.error_message = "Report file not found"
                test_case.save()
                return

            # In the documents there is a global, and then a profile_report for each test_case
            documents: list[Any] = []
            with (report_path / report_file).open() as f:
                documents = list(yaml.safe_load_all(f))

            # Process global report
            global_report_instance = self._process_global_report(documents[0], test_case)

            # Process profile reports
            self._process_profile_reports(documents[1:], global_report_instance, results_path)

            logger.info(f"Successfully processed results for test case {test_case.id}")

        except Exception as e:  # noqa: BLE001
            # Catching broad Exception for logging and error reporting
            logger.error(f"Error processing test results: {e!s}")
            test_case.status = "FAILURE"
            test_case.error_message = f"Error processing results: {e!s}"
            test_case.save()

    def _process_global_report(self, global_report: dict[str, Any], test_case: TestCase) -> GlobalReport:
        """Process global report and create GlobalReport instance."""
        global_avg_response_time = global_report["Global report"]["Average assistant response time"]
        global_min_response_time = global_report["Global report"]["Minimum assistant response time"]
        global_max_response_time = global_report["Global report"]["Maximum assistant response time"]

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
            error_conversations = list(error["conversations"])

            TestError.objects.create(
                code=error_code,
                count=error_count,
                conversations=error_conversations,
                global_report=global_report_instance,
            )

        return global_report_instance

    def _process_profile_reports(
        self, profile_reports: list[dict[str, Any]], global_report_instance: GlobalReport, results_path: str
    ) -> None:
        """Process profile reports and create ProfileReport instances."""
        # Profile reports are in the documents from 1 to n
        for profile_report in profile_reports:
            profile_report_name = profile_report["Test name"]
            profile_report_avg_response_time = profile_report["Average assistant response time"]
            profile_report_min_response_time = profile_report["Minimum assistant response time"]
            profile_report_max_response_time = profile_report["Maximum assistant response time"]

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
            conversations_dir = Path(results_path) / "conversation_outputs" / profile_report_name
            if conversations_dir.exists():
                subdirs = [d for d in conversations_dir.iterdir() if d.is_dir()]
                if subdirs:
                    # Since we dont have the date and hour, we get the first directory (the only one)
                    conversations_dir = subdirs[0]
                    logger.info(f"Conversations dir: {conversations_dir}")

                    # Get the first conversation file to extract common fields
                    conv_files = sorted(
                        [f.name for f in conversations_dir.iterdir() if f.is_file() and f.name.endswith(".yml")]
                    )
                    logger.info(f"Conversation files: {conv_files}")
                    if conv_files:
                        logger.info(f"First conversation file: {conv_files[0]}")
                        first_conv_path = conversations_dir / conv_files[0]
                        profile_data = self._process_profile_report_from_conversation(first_conv_path)

                        # Update profile report with common fields
                        for field, value in profile_data.items():
                            setattr(profile_report_instance, field, value)
                        profile_report_instance.save()

                        # Process each conversation file
                        for conv_file in conv_files:
                            conv_path = conversations_dir / conv_file
                            conv_data = self._process_conversation(conv_path)

                            Conversation.objects.create(profile_report=profile_report_instance, **conv_data)

            # Errors in the profile report
            test_errors = profile_report["Errors"]
            logger.info(f"Test errors: {test_errors}")
            for error in test_errors:
                error_code = error["error"]
                error_count = error["count"]
                error_conversations = list(error["conversations"])

                TestError.objects.create(
                    code=error_code,
                    count=error_count,
                    conversations=error_conversations,
                    profile_report=profile_report_instance,
                )

    def _process_profile_report_from_conversation(self, conversation_file_path: Path) -> dict[str, Any]:
        """Read common fields from first conversation file."""
        with conversation_file_path.open() as file:
            data = yaml.safe_load_all(file)
            first_doc = next(data)

            # Extract conversation specs
            conv_specs = first_doc.get("conversation", {})
            interaction_style: dict[str, Any] = next(
                (item["interaction_style"] for item in conv_specs if "interaction_style" in item),
                {},
            )
            number = next((item["number"] for item in conv_specs if "number" in item), 0)
            steps = next((item["steps"] for item in conv_specs if "steps" in item), None)
            # Extract all_answered with limit if present
            all_answered_item = next((item for item in conv_specs if "all_answered" in item), None)
            all_answered: dict[str, Any] | None = None
            if all_answered_item:
                if isinstance(all_answered_item["all_answered"], dict):
                    all_answered = all_answered_item["all_answered"]
                else:
                    all_answered = {"value": all_answered_item["all_answered"]}

            # Extract personality from context details
            context_items = first_doc.get("context", [])
            personality = ""
            filtered_context_details = []

            for item in context_items:
                if isinstance(item, str) and item.startswith("personality: "):
                    # Extract personality value after "personality: "
                    personality = item.replace("personality: ", "")
                elif isinstance(item, dict) and "personality" in item:
                    # Handle dict format for backward compatibility
                    personality = item["personality"]
                else:
                    # Keep non-personality items in context_details
                    filtered_context_details.append(item)

            return {
                "serial": first_doc.get("serial"),
                "language": first_doc.get("language", ""),
                "personality": personality,
                "context_details": filtered_context_details,
                "interaction_style": interaction_style,
                "number_conversations": number,
                "steps": steps,
                "all_answered": all_answered,
            }

    def _process_conversation(self, conversation_file_path: Path) -> dict[str, Any]:
        """Process individual conversation file."""
        # File name without extension
        name = conversation_file_path.stem
        with conversation_file_path.open() as file:
            docs = list(yaml.safe_load_all(file))
            main_doc = docs[0]

            # Split the document at the separator lines
            return {
                "name": name,
                "ask_about": main_doc.get("ask_about", {}),
                "data_output": main_doc.get("data_output", {}),
                "errors": main_doc.get("errors", {}),
                "total_cost": float(main_doc.get("total_cost($)", 0)),
                "conversation_time": float(docs[1].get("conversation time", 0)),
                "response_times": docs[1].get("assistant response time", []),
                "response_time_avg": docs[1].get("response time report", {}).get("average", 0),
                "response_time_max": docs[1].get("response time report", {}).get("max", 0),
                "response_time_min": docs[1].get("response time report", {}).get("min", 0),
                "interaction": docs[2].get("interaction", []),
            }

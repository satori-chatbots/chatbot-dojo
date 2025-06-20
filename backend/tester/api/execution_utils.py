"""Utility functions for test execution."""

import os

import yaml
from django.conf import settings

from .base import logger


class ExecutionUtils:
    """Utility functions for test execution and management."""

    def calculate_total_conversations(self, test_case, project_path):
        """Calculate total conversations from copied files"""
        try:
            total_conversations = 0
            names = []

            for copied_file in test_case.copied_files:
                file_path = os.path.join(settings.MEDIA_ROOT, copied_file["path"])
                try:
                    # Load the YAML content
                    with open(file_path) as file:
                        yaml_content = yaml.safe_load(file)

                    # Get the test_name from the file
                    test_name = yaml_content.get("test_name", "Unknown")
                    names.append(test_name)

                    # Calculate conversations from conversation data
                    conv_data = yaml_content.get("conversation")

                    if isinstance(conv_data, list):
                        num_conversations = sum(item.get("number", 0) for item in conv_data if isinstance(item, dict))
                    elif isinstance(conv_data, dict):
                        num_conversations = conv_data.get("number", 0)
                    else:
                        num_conversations = 0

                    total_conversations += num_conversations
                    logger.info(f"Profile '{test_name}': {num_conversations} conversations")

                except Exception as e:
                    logger.error(f"Error processing YAML file: {e!s}")

            test_case.total_conversations = total_conversations
            test_case.profiles_names = names
            test_case.save()
            logger.info(f"Total conversations calculated: {total_conversations}")

        except Exception as e:
            logger.error(f"Error calculating total conversations: {e!s}")

    @staticmethod
    def get_connector_path(technology):
        """Get the connector path based on the technology"""
        # Map technology to connector file path (relative to user-simulator directory)
        connector_map = {
            "taskyto": "data/connectors/taskyto.yml",
            "rasa": "data/connectors/rasa.yml",
            "serviceform": "data/connectors/serviceform.yml",
            "millionbot": "data/connectors/millionbot_ada.yml",
            "dialogflow": "data/connectors/dialogflow.yml",
            "julie": "data/connectors/julie.yml",
            "kuki": "data/connectors/kuki.yml",
        }
        return connector_map.get(technology, "data/connectors/taskyto.yml")  # Default to taskyto

    @staticmethod
    def get_user_profile_name(test_case):
        """Get the user profile path from the copied files"""
        if test_case.copied_files:
            # Return the directory name where the files are located
            return f"testcase_{test_case.id}"
        return f"testcase_{test_case.id}"

    @staticmethod
    def build_run_yml_config(
        project,
        test_case,
        profiles_directory,
        results_path,
        technology,
        link,
        user_simulator_dir,
    ):
        """Build the run.yml configuration dictionary"""
        # Determine the connector path based on technology
        connector_path = ExecutionUtils.get_connector_path(technology)

        # Get the user profile path - this should be just the subdirectory name within profiles
        user_profile = ExecutionUtils.get_user_profile_name(test_case)

        # Make extract path relative to user-simulator directory
        extract_path = os.path.relpath(results_path, user_simulator_dir)

        # Build the run.yml configuration
        config_data = {
            "project_folder": f"project_{project.id}",
            "user_profile": user_profile,
            "technology": technology,
            "connector": connector_path,
            "connector_parameters": {},
            "extract": extract_path,
            "#execution_parameters": [
                "# - verbose",
                "# - clean_cache",
                "# - update_cache",
                "# - ignore_cache",
            ],
        }

        # If there's a link, it might contain connector parameters
        if link:
            # Try to parse link as connector parameters if it's JSON-like
            try:
                import json

                connector_params = json.loads(link)
                config_data["connector_parameters"] = connector_params
            except (json.JSONDecodeError, ValueError):
                # If it's not JSON, it might be a URL that needs to be added to connector parameters
                config_data["connector_parameters"] = {"api_url": link}

        return config_data

    @staticmethod
    def write_run_yml(config_data, project):
        """Write the run.yml configuration to file"""
        try:
            # Write the run.yml file
            run_yml_path = os.path.join(project.get_project_path(), "run.yml")
            os.makedirs(os.path.dirname(run_yml_path), exist_ok=True)

            with open(run_yml_path, "w") as f:
                yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)

            logger.info(f"Created run.yml at {run_yml_path}")
            logger.info(f"Run.yml content: {config_data}")

        except Exception as e:
            logger.error(f"Error writing run.yml: {e!s}")
            raise

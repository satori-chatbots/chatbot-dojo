from typing import Dict, List, Union, Optional
from dataclasses import dataclass
import yaml


@dataclass
class ValidationError:
    message: str
    path: str
    line: Optional[int] = None


class YamlValidator:
    def __init__(self):
        self.required_top_level = [
            "test_name",
            "llm",
            "user",
            "conversation",
            "chatbot",
        ]
        self.required_nested = {
            "llm": ["model", "temperature", "format"],
            "llm.format": ["type"],
            "user": ["language", "role", "context", "goals"],
            "chatbot": ["is_starter", "fallback", "output"],
            "conversation": ["number", "max_cost", "goal_style", "interaction_style"],
        }
        self.valid_formats = ["text", "speech"]
        self.valid_goal_functions = ["default()", "random()", "another()", "forward()"]
        self.valid_variable_types = ["string", "float", "int"]

    def validate(self, yaml_content: str) -> List[ValidationError]:
        """Validate YAML content against schema rules.
        Checks that all required fields are present and have the correct type.
        """
        errors = []
        try:
            data = yaml.safe_load(yaml_content)
            if not isinstance(data, dict):
                return [ValidationError("Root level must be a dictionary", "/")]

            # Validate top-level required fields
            errors.extend(self._validate_required_fields(data))

            # Validate specific sections
            if "llm" in data:
                errors.extend(self._validate_llm_section(data["llm"]))

            if "user" in data:
                errors.extend(self._validate_user_section(data["user"]))

            if "chatbot" in data:
                errors.extend(self._validate_chatbot_section(data["chatbot"]))

            if "conversation" in data:
                errors.extend(self._validate_conversation_section(data["conversation"]))

            return errors

        except yaml.YAMLError as e:
            return [ValidationError(f"Invalid YAML syntax: {str(e)}", "/")]

    def _validate_required_fields(self, data: Dict) -> List[ValidationError]:
        """Validate that all required fields are present."""
        errors = []

        for field in self.required_top_level:
            if field not in data:
                errors.append(
                    ValidationError(f"Missing required field: {field}", f"/{field}")
                )

        # Check nested required fields
        for path, fields in self.required_nested.items():
            parts = path.split(".")
            current = data
            for part in parts:
                if not isinstance(current, dict) or part not in current:
                    break
                current = current[part]
            else:
                for field in fields:
                    if not isinstance(current, dict) or field not in current:
                        errors.append(
                            ValidationError(
                                f"Missing required field: {field} in {path}",
                                f"/{path}/{field}",
                            )
                        )

        return errors

    def _validate_llm_section(self, llm: Dict) -> List[ValidationError]:
        """Validate LLM section configuration."""
        errors = []

        # Check that temperature is a number between 0 and 1
        if "temperature" in llm:
            temp = llm["temperature"]
            if not isinstance(temp, (int, float)) or temp < 0 or temp > 1:
                errors.append(
                    ValidationError(
                        "Temperature must be a number between 0 and 1",
                        "/llm/temperature",
                    )
                )

        # Validate format section
        if "format" in llm and isinstance(llm["format"], dict):
            format_section = llm["format"]
            format_type = format_section.get("type")

            # Validate format type
            if format_type and format_type not in self.valid_formats:
                errors.append(
                    ValidationError(
                        f"Invalid format type. Must be one of: {', '.join(self.valid_formats)}",
                        "/llm/format/type",
                    )
                )

            # If type is speech, check for config
            if format_type == "speech":
                if "config" not in format_section:
                    errors.append(
                        ValidationError(
                            "Speech format requires 'config' field with path to configuration file",
                            "/llm/format/config",
                        )
                    )
                # Check that the string is a path
                elif format_section["config"] == "":
                    errors.append(
                        ValidationError(
                            "Speech format requires 'config' field with path to configuration file",
                            "/llm/format/config",
                        )
                    )

        return errors

    def _validate_user_section(self, user: Dict) -> List[ValidationError]:
        """Validate user section configuration."""
        errors = []

        if "goals" in user and isinstance(user["goals"], list):
            for i, goal in enumerate(user["goals"]):
                if isinstance(goal, dict):
                    if "function" in goal:
                        func = goal["function"]
                        if not any(
                            func.startswith(valid_func.replace("()", ""))
                            for valid_func in self.valid_goal_functions
                        ):
                            errors.append(
                                ValidationError(
                                    f"Invalid goal function. Must be one of: {', '.join(self.valid_goal_functions)}",
                                    f"/user/goals/{i}/function",
                                )
                            )

                    if "type" in goal and goal["type"] not in self.valid_variable_types:
                        errors.append(
                            ValidationError(
                                f"Invalid variable type. Must be one of: {', '.join(self.valid_variable_types)}",
                                f"/user/goals/{i}/type",
                            )
                        )

        return errors

    def _validate_chatbot_section(self, chatbot: Dict) -> List[ValidationError]:
        """Validate chatbot section configuration."""
        errors = []

        if "output" in chatbot and isinstance(chatbot["output"], list):
            for i, output in enumerate(chatbot["output"]):
                if isinstance(output, dict):
                    if "type" not in output:
                        errors.append(
                            ValidationError(
                                "Output must have a type", f"/chatbot/output/{i}"
                            )
                        )
                    if "description" not in output:
                        errors.append(
                            ValidationError(
                                "Output must have a description", f"/chatbot/output/{i}"
                            )
                        )

        return errors

    def _validate_conversation_section(
        self, conversation: Dict
    ) -> List[ValidationError]:
        """Validate conversation section configuration."""
        errors = []

        if "number" in conversation:
            num = conversation["number"]
            if not isinstance(num, int) or num <= 0:
                errors.append(
                    ValidationError(
                        "Number of conversations must be a positive integer",
                        "/conversation/number",
                    )
                )

        if "max_cost" in conversation:
            cost = conversation["max_cost"]
            if not isinstance(cost, (int, float)) or cost <= 0:
                errors.append(
                    ValidationError(
                        "Max cost must be a positive number", "/conversation/max_cost"
                    )
                )

        return errors


# Usage example:
if __name__ == "__main__":
    validator = YamlValidator()

    # Example YAML content
    yaml_content = """
    test_name: "Example Test"
    llm:
      temperature: 0.7
      model: "gpt-4"
      format:
        type: speech
        config: fddfasd
    user:
      language: "english"
      role: "customer"
      context:
        - personality: "friendly"
      goals:
        - function: "random()"
          type: "string"
          data:
            - "goal1"
            - "goal2"
    chatbot:
      is_starter: true
      fallback: "I don't understand"
      output:
        - type: "string"
          description: "User response"
    conversation:
      number: 5
      max_cost: 10.0
      goal_style: "default"
      interaction_style:
        - "friendly"
    """
    print("Starting...")

    errors = validator.validate(yaml_content)
    for error in errors:
        print(f"Error at {error.path}: {error.message}")

    if not errors:
        print("No errors found.")

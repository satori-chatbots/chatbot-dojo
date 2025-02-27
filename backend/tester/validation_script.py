from typing import Dict, List, Union, Optional
from dataclasses import dataclass
import yaml
import re


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

        # Check for unquoted variables that might cause YAML parsing issues
        # YAML usually works without "" but if there are braces it needs them
        lines = yaml_content.split("\n")
        for i, line in enumerate(lines):
            if "{{" in line and "}}" in line and not ('"{{' in line or "'{{" in line):
                # This line has curly braces but they're not quoted
                errors.append(
                    ValidationError(
                        "Variables with curly braces {{}} must be quoted in YAML",
                        f"/line/{i + 1}",
                        i + 1,
                    )
                )

        if errors:
            return errors

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

        # Validate context structure
        if "context" in user:
            if not isinstance(user["context"], list):
                errors.append(
                    ValidationError(
                        "User context must be a list",
                        "/user/context",
                    )
                )
            else:
                # Track if we've seen a personality item
                has_personality = False

                for i, item in enumerate(user["context"]):
                    # Check if it's a personality item (dictionary with personality key)
                    if isinstance(item, dict):
                        if "personality" in item:
                            if has_personality:
                                errors.append(
                                    ValidationError(
                                        "Only one personality entry is allowed in context",
                                        f"/user/context/{i}",
                                    )
                                )
                            has_personality = True

                            # Validate that personality points to a path
                            if (
                                not isinstance(item["personality"], str)
                                or item["personality"] == ""
                            ):
                                errors.append(
                                    ValidationError(
                                        "Personality must be a non-empty string path",
                                        f"/user/context/{i}/personality",
                                    )
                                )
                    # All non-dictionary items must be strings
                    elif not isinstance(item, str):
                        errors.append(
                            ValidationError(
                                "Context items must be either a personality dictionary or string",
                                f"/user/context/{i}",
                            )
                        )

        # Validate goals structure
        if "goals" in user:
            if not isinstance(user["goals"], list):
                errors.append(
                    ValidationError(
                        "User goals must be a list",
                        "/user/goals",
                    )
                )
            else:
                # First pass: collect all defined variables
                defined_variables = set()
                for goal in user["goals"]:
                    if isinstance(goal, dict) and len(goal) == 1:
                        var_name = list(goal.keys())[0]
                        defined_variables.add(var_name)

                # Second pass: validate all goals (strings and variable definitions)
                for i, goal in enumerate(user["goals"]):
                    # Goals can be either strings (prompts) or dictionaries (variables)
                    if isinstance(goal, str):
                        # Check if the string contains variable placeholders
                        var_placeholders = re.findall(r"{{(\w+)}}", goal)
                        for var in var_placeholders:
                            # Make sure variables used are defined somewhere in the goals
                            if var not in defined_variables:
                                errors.append(
                                    ValidationError(
                                        f"Variable '{var}' used in goal but not defined",
                                        f"/user/goals/{i}",
                                    )
                                )

                    elif isinstance(goal, dict):
                        # Each dict should have only one key, which is the variable name
                        if len(goal) != 1:
                            errors.append(
                                ValidationError(
                                    "Each variable definition must have exactly one key",
                                    f"/user/goals/{i}",
                                )
                            )
                        else:
                            var_name = list(goal.keys())[0]
                            var_def = goal[var_name]

                            # Check required fields for variable definition
                            if not isinstance(var_def, dict):
                                errors.append(
                                    ValidationError(
                                        f"Variable '{var_name}' definition must be a dictionary",
                                        f"/user/goals/{i}/{var_name}",
                                    )
                                )
                                continue

                            # Check required fields
                            for field in ["function", "type", "data"]:
                                if field not in var_def:
                                    errors.append(
                                        ValidationError(
                                            f"Missing required field '{field}' in variable '{var_name}'",
                                            f"/user/goals/{i}/{var_name}",
                                        )
                                    )

                            # Validate type
                            if "type" in var_def:
                                var_type = var_def["type"]
                                if var_type not in ["string", "int", "float"]:
                                    errors.append(
                                        ValidationError(
                                            f"Invalid variable type '{var_type}'. Must be 'string', 'int', or 'float'",
                                            f"/user/goals/{i}/{var_name}/type",
                                        )
                                    )

                            # Validate function
                            if "function" in var_def:
                                func = var_def["function"]

                                # Basic function validation
                                valid_function = False

                                # Check for default(), another(), forward() without parameters
                                if func in ["default()", "another()", "forward()"]:
                                    valid_function = True

                                # Check for random() with different formats
                                elif func == "random()":
                                    valid_function = True
                                elif func.startswith("random(") and func.endswith(")"):
                                    # Extract the parameter
                                    random_length = len("random(")
                                    param = func[random_length:-1]
                                    if param == "rand" or param.isdigit():
                                        valid_function = True

                                # Check for forward with nested variable
                                elif func.startswith("forward(") and func.endswith(")"):
                                    nested_length = len("forward(")
                                    nested_var = func[nested_length:-1]
                                    if (
                                        nested_var in defined_variables
                                        or nested_var == ""
                                    ):
                                        valid_function = True
                                    else:
                                        errors.append(
                                            ValidationError(
                                                f"Forward function references undefined variable '{nested_var}'",
                                                f"/user/goals/{i}/{var_name}/function",
                                            )
                                        )
                                        valid_function = True  # Avoid duplicate error

                                if not valid_function:
                                    errors.append(
                                        ValidationError(
                                            f"Invalid function '{func}'. Must be one of: default(), random(), random(n), random(rand), another(), forward() or forward(var)",
                                            f"/user/goals/{i}/{var_name}/function",
                                        )
                                    )

                            # Validate data structure based on type
                            if "data" in var_def and "type" in var_def:
                                data = var_def["data"]
                                var_type = var_def["type"]

                                # For numeric types with range definition
                                if var_type in ["int", "float"] and isinstance(
                                    data, dict
                                ):
                                    # Check for min/max
                                    if "min" not in data:
                                        errors.append(
                                            ValidationError(
                                                "Missing 'min' in numeric range definition",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )
                                    if "max" not in data:
                                        errors.append(
                                            ValidationError(
                                                "Missing 'max' in numeric range definition",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )
                                    # Check that min is smaller than max
                                    if data["min"] >= data["max"]:
                                        errors.append(
                                            ValidationError(
                                                "Minimum value must be smaller than maximum value",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )

                                    # Check that either step or linspace is provided for float
                                    if (
                                        var_type == "float"
                                        and "step" not in data
                                        and "linspace" not in data
                                    ):
                                        errors.append(
                                            ValidationError(
                                                "Float range must define either 'step' or 'linspace'",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )

                                    # For int, check that step is provided
                                    if var_type == "int" and "step" not in data:
                                        errors.append(
                                            ValidationError(
                                                "Integer range must define 'step'",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )

                                # For list data, check that it's actually a list
                                elif not isinstance(data, list) and not isinstance(
                                    data, dict
                                ):
                                    errors.append(
                                        ValidationError(
                                            "Data must be a list, range definition, or custom function",
                                            f"/user/goals/{i}/{var_name}/data",
                                        )
                                    )

                                # For custom function data
                                elif isinstance(data, dict) and "file" in data:
                                    if "function_name" not in data:
                                        errors.append(
                                            ValidationError(
                                                "Custom function data must include 'function_name'",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )
                                    if "args" not in data:
                                        errors.append(
                                            ValidationError(
                                                "Custom function data must include 'args'",
                                                f"/user/goals/{i}/{var_name}/data",
                                            )
                                        )

                                # For list data, validate any() functions if present
                                elif isinstance(data, list):
                                    for j, item in enumerate(data):
                                        if isinstance(item, str):
                                            # Check for any() function format
                                            if item.startswith("any("):
                                                if not item.endswith(")"):
                                                    errors.append(
                                                        ValidationError(
                                                            f"Malformed any() function: Missing closing parenthesis in '{item}'",
                                                            f"/user/goals/{i}/{var_name}/data/{j}",
                                                        )
                                                    )
                                                elif (
                                                    len(item) <= 5
                                                ):  # "any()" has length 5
                                                    errors.append(
                                                        ValidationError(
                                                            "Empty any() function: Must contain instructions",
                                                            f"/user/goals/{i}/{var_name}/data/{j}",
                                                        )
                                                    )
                                                # Check for balanced parentheses within any()
                                                elif item.count("(") != item.count(")"):
                                                    errors.append(
                                                        ValidationError(
                                                            f"Unbalanced parentheses in any() function: '{item}'",
                                                            f"/user/goals/{i}/{var_name}/data/{j}",
                                                        )
                                                    )
                                        elif not isinstance(
                                            item, (str, int, float, bool)
                                        ):
                                            errors.append(
                                                ValidationError(
                                                    f"Invalid data list item type: {type(item).__name__}. Must be a primitive value or any() function",
                                                    f"/user/goals/{i}/{var_name}/data/{j}",
                                                )
                                            )

                    else:
                        errors.append(
                            ValidationError(
                                "Goals must be either strings or dictionaries",
                                f"/user/goals/{i}",
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
    test_name: Example Test
    llm:
      temperature: 0.7
      model: gpt-4o-mini
      format:
        type: text
    user:
      language: English
      role: customer
      context:
        - yapper
      goals:
        - "{{cans}} cans of {{drink}}"

        - cans:
            function: forward(drink)
            type: int
            data:
              min: 1
              max: 3
              step: 1

        - drink:
            function: forward()
            type: string
            data:
              - any()

    chatbot:
      is_starter: true
      fallback: I don't understand
      output:
        - type: string
          description: User response
    conversation:
      number: 5
      max_cost: 10.0
      goal_style: default
      interaction_style:
        - friendly
    """
    print("Starting...")

    errors = validator.validate(yaml_content)
    for error in errors:
        print(f"Error at {error.path}: {error.message}")

    if not errors:
        print("No errors found.")

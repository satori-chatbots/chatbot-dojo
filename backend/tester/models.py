"""Models for the tester app."""

import logging
import os
import shutil
from pathlib import Path
from typing import Any, ClassVar

import yaml
from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .validation_script import YamlValidator

# Configure logger
logger = logging.getLogger(__name__)

# Error messages
FERNET_KEY_ERROR = "FERNET_SECRET_KEY is not set in the environment!"
EMAIL_REQUIRED_ERROR = "Email is a required field"

# Load FERNET SECRET KEY (it was loaded in the settings.py before)
FERNET_KEY = os.getenv("FERNET_SECRET_KEY")
if not FERNET_KEY:
    raise ValueError(FERNET_KEY_ERROR)

# Create cipher suite
cipher_suite = Fernet(FERNET_KEY)


class UserAPIKey(models.Model):
    """Model to store the API keys for the users.

    It has a name, the encrypted API key and the user it belongs to
    """

    PROVIDER_CHOICES: ClassVar[list[tuple[str, str]]] = [
        ("openai", "OpenAI"),
        ("gemini", "Google Gemini"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=255)
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default="openai")
    api_key_encrypted = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        """Return a string representation of the UserAPIKey."""
        return f"{self.name} ({self.get_provider_display()})"

    def set_api_key(self, api_key: str) -> None:
        """Encrypt and store the provided API key."""
        encrypted_key = cipher_suite.encrypt(api_key.encode())
        self.api_key_encrypted = encrypted_key.decode()
        self.save()

    def get_api_key(self) -> str | None:
        """Decrypt and return the stored API key."""
        if self.api_key_encrypted:
            return cipher_suite.decrypt(self.api_key_encrypted.encode()).decode()
        return None


class CustomUserManager(BaseUserManager):
    """Custom user manager for the CustomUser model."""

    def create_user(self, email: str, password: str | None = None, **extra_fields: Any) -> "CustomUser":  # noqa: ANN401
        """Create and save a user with the given email and password."""
        if not email:
            raise ValueError(EMAIL_REQUIRED_ERROR)

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra_fields: Any) -> "CustomUser":  # noqa: ANN401
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """Custom user model."""

    # Default model doesnt make it unique
    email = models.EmailField(max_length=255, unique=True)
    # Username doesnt really matter for now since we are using email as the main identifier
    username = models.CharField(max_length=255, blank=True)

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    def set_api_key(self) -> None:
        """Encrypt and store the API Key."""
        api_key: str = self.api_key  # type: ignore[assignment,has-type]
        encrypted_key = cipher_suite.encrypt(api_key.encode())
        self.api_key = encrypted_key.decode()
        self.save()

    def get_api_key(self) -> str | None:
        """Decrypt and return the API Key."""
        if self.api_key_encrypted:
            return cipher_suite.decrypt(self.api_key_encrypted.encode()).decode()
        return None


def upload_to(instance: "TestFile", filename: str) -> str:
    """Returns the path where the Test Files are stored."""
    # The test_name should have been set by the model's clean method
    # Get the user and project id
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/profiles/{filename}"


def upload_to_personalities(instance: "PersonalityFile", filename: str) -> str:
    """Returns the path where the Personality files are stored."""
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/personalities/{filename}"


def upload_to_rules(instance: "RuleFile", filename: str) -> str:
    """Returns the path where the Rules files are stored."""
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/rules/{filename}"


def upload_to_types(instance: "TypeFile", filename: str) -> str:
    """Returns the path where the Types files are stored."""
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/types/{filename}"


def upload_to_execution(instance: "TestFile", filename: str) -> str:
    """Returns the path where Test Files are stored in execution folders."""
    user_id = instance.project.owner.id
    project_id = instance.project.id

    # If execution is provided, use execution-based path
    if instance.execution:
        execution_name = instance.execution.execution_name.lower()
        return f"projects/user_{user_id}/project_{project_id}/executions/{execution_name}/profiles/{filename}"

    # Fallback to old path structure (backward compatibility)
    return f"projects/user_{user_id}/project_{project_id}/profiles/{filename}"


class TestFile(models.Model):
    """Model to store the uploaded User Profiles YAML files.

    These are the models that are available to the user to run tests, each testfile belongs to a project
    Once the test is run, this file is copied to the project folder so that if this one is modified or even deleted, you can still see the original file that was used to run the test
    """

    file = models.FileField(upload_to=upload_to_execution)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey("Project", related_name="test_files", on_delete=models.CASCADE)
    is_valid = models.BooleanField(
        default=False,
        help_text="Whether the YAML file is valid for execution in Sensei",
    )
    execution = models.ForeignKey(
        "ProfileExecution", on_delete=models.CASCADE, null=True, blank=True, related_name="test_files"
    )

    def __str__(self) -> str:
        """Return the base name of the file."""
        return Path(self.file.name).name

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        """Save the TestFile instance."""
        # If no execution is assigned and this is a new file, create/assign a manual execution
        if not self.execution and not self.pk:
            self.execution = self.project.get_or_create_current_manual_execution()

        super().save(*args, **kwargs)

        # After saving, try to read and process the file
        if self.file and hasattr(self.file, "path") and Path(self.file.path).exists():
            try:
                # First read the file for validation
                with Path(self.file.path).open() as file:
                    yaml_content = file.read()

                # Validate using YamlValidator
                validator = YamlValidator()
                validation_errors = validator.validate(yaml_content)

                # Parse the YAML content for further processing
                data = yaml.safe_load(yaml_content)
                test_name = data.get("test_name")

                if not test_name:
                    self.is_valid = False
                    TestFile.objects.filter(pk=self.pk).update(is_valid=False)
                    return

                # Create new filename and change the extension to yaml
                new_filename = f"{test_name}.yaml"

                # Generate new path using execution folder structure
                user_id = self.project.owner.id
                project_id = self.project.id

                if self.execution:
                    execution_name = self.execution.execution_name.lower()
                    new_path = f"projects/user_{user_id}/project_{project_id}/executions/{execution_name}/profiles/{new_filename}"
                else:
                    # Fallback to old structure
                    new_path = f"projects/user_{user_id}/project_{project_id}/profiles/{new_filename}"

                # Rename the file
                old_path = self.file.path
                new_full_path = Path(settings.MEDIA_ROOT) / new_path

                # Create parent directories if they don't exist
                new_full_path.parent.mkdir(parents=True, exist_ok=True)
                Path(old_path).rename(new_full_path)

                # Update the model
                self.file.name = new_path
                self.name = test_name

                # Set validation status - only boolean flag
                self.is_valid = not bool(validation_errors)

                # Update execution profile count
                if self.execution:
                    profile_count = self.execution.test_files.count()
                    self.execution.generated_profiles_count = profile_count
                    self.execution.save(update_fields=["generated_profiles_count"])

                # Save again with updated fields
                TestFile.objects.filter(pk=self.pk).update(file=self.file.name, name=self.name, is_valid=self.is_valid)

            except (FileNotFoundError, yaml.YAMLError) as e:
                logger.warning("Error processing TestFile %s: %s", self.pk, e)
                self.is_valid = False
                TestFile.objects.filter(pk=self.pk).update(is_valid=False)


@receiver(post_delete, sender=TestFile)
def delete_file_from_media(sender: type[TestFile], instance: TestFile, **_kwargs: Any) -> None:  # noqa: ANN401
    """Delete the file from media when the TestFile is deleted."""
    try:
        if instance.file and Path(instance.file.path).exists():
            Path(instance.file.path).unlink()
            logger.info("Deleted file %s from media.", instance.file.path)
    except FileNotFoundError:
        logger.warning("File %s not found. It may have already been deleted.", instance.file.path)
    except PermissionError:
        logger.exception("Permission denied while trying to delete file %s.", instance.file.path)
    except OSError:
        logger.exception("OS error occurred while deleting file %s", instance.file.path)


# Use post_save signal to set name after the file is saved
@receiver(post_save, sender=TestFile)
def set_name(sender: type[TestFile], instance: TestFile, *, created: bool, **kwargs: Any) -> None:  # noqa: ANN401
    """Set the name of the TestFile to the "test_name" field in the YAML file."""


class Project(models.Model):
    """A Project is a collection of test cases, it uses one chatbot connector."""

    # Name of the project, must be unique for the user
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    # A project can only have one chatbot connector, but a connector can be used in multiple projects
    chatbot_connector = models.ForeignKey("ChatbotConnector", related_name="projects", on_delete=models.CASCADE)

    # Owner of the project
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="projects", on_delete=models.CASCADE)

    # Visibility of the project
    # This makes the project visible, but not editable by other users
    public = models.BooleanField(default=False)

    # API Key for the project
    # A user has multiple API keys and he can assign one to a project
    # If the user deletes the API key, the project will be assigned to None
    api_key = models.ForeignKey(
        UserAPIKey,
        related_name="projects",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
    )

    # LLM Model to use for exploration (provider comes from the API key)
    llm_model = models.CharField(
        max_length=100,
        blank=True,
        help_text="LLM model for exploration in TRACER (e.g., gpt-4o-mini, gemini-2.0-flash)",
    )

    # LLM Model to use inside the generated profiles
    profile_model = models.CharField(
        max_length=100,
        blank=True,
        help_text="LLM model to embed in generated profiles (e.g., gpt-4o-mini, gemini-2.0-flash)",
    )

    def __str__(self) -> str:
        """Return the name of the project."""
        return self.name

    @property
    def llm_provider(self) -> str | None:
        """Get the LLM provider from the associated API key."""
        if self.api_key:
            return self.api_key.provider
        return None

    def get_project_path(self) -> str:
        """Get the full filesystem path to the project folder."""
        return str(Path(settings.MEDIA_ROOT) / "projects" / f"user_{self.owner.id}" / f"project_{self.id}")

    def get_run_yml_path(self) -> str:
        """Get the path to the run.yml file for this project."""
        return str(Path(self.get_project_path()) / "run.yml")

    def update_run_yml(self) -> None:
        """Update the run.yml file with current project configuration."""
        config_data: dict[str, Any] = {
            "project_folder": f"project_{self.id}",
            "user_profile": "",
            "technology": self.chatbot_connector.technology if self.chatbot_connector else "",
            "connector": self.chatbot_connector.link if self.chatbot_connector else "",
            "connector_parameters": {},
            "extract": "",
            "#execution_parameters": [
                "# - verbose",
                "# - clean_cache",
                "# - update_cache",
                "# - ignore_cache",
            ],
        }

        # Update with saved config if it exists
        try:
            if hasattr(self, "config") and self.config:
                if self.config.user_profile:
                    config_data["user_profile"] = self.config.user_profile
                if self.config.connector:
                    config_data["connector"] = self.config.connector
                if self.config.connector_parameters:
                    config_data["connector_parameters"] = self.config.connector_parameters
                if self.config.extract_path:
                    config_data["extract"] = self.config.extract_path
                if self.config.execution_parameters:
                    config_data["execution_parameters"] = self.config.execution_parameters
        except (AttributeError, TypeError):
            pass  # If config doesn't exist, use defaults

        run_yml_path = self.get_run_yml_path()
        Path(run_yml_path).parent.mkdir(parents=True, exist_ok=True)

        try:
            with Path(run_yml_path).open("w") as f:
                yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)
            logger.info("Updated run.yml at %s", run_yml_path)
        except yaml.YAMLError:
            logger.exception("Error creating run.yml")

    def create_manual_execution_folder(self) -> "ProfileExecution":
        """Create a new manual profile execution folder for organizing profiles."""
        # Use a fixed name for manual executions - no timestamp
        execution_name = "Manual_Profiles"

        # Create directory structure
        user_id = self.owner.id
        project_id = self.id
        execution_dir = f"projects/user_{user_id}/project_{project_id}/executions/manual_profiles"

        # Create execution record
        return ProfileExecution.objects.create(
            project=self,
            execution_name=execution_name,
            execution_type="manual",
            status="SUCCESS",  # Manual executions are always successful
            profiles_directory=execution_dir,
        )

    def get_or_create_current_manual_execution(self) -> "ProfileExecution":
        """Get the single manual execution folder for this project, or create one if none exists."""
        # Look for THE manual execution for this project (there should only be one)
        manual_execution = self.profile_executions.filter(execution_type="manual").first()

        if manual_execution:
            return manual_execution

        return self.create_manual_execution_folder()


@receiver(post_delete, sender=Project)
def delete_project_directory(sender: type[Project], instance: Project, **_kwargs: Any) -> None:  # noqa: ANN401
    """Delete the entire project directory when the Project is deleted."""
    project_path = instance.get_project_path()
    if Path(project_path).exists():
        try:
            shutil.rmtree(project_path)
            logger.info("Deleted project directory: %s", project_path)
        except OSError:
            logger.exception("Error deleting project directory %s", project_path)


CONNECTOR_CHOICES = [
    ("rasa", "Rasa"),
    ("taskyto", "Taskyto"),
    ("ada-uam", "Ada UAM"),
    ("millionbot", "Millionbot"),
    ("genion", "Genion"),
    ("lola", "Lola"),
    ("serviceform", "Serviceform"),
    ("kuki", "Kuki"),
    ("julie", "Julie"),
    ("rivas_catalina", "Rivas Catalina"),
    ("saic_malaga", "Saic Malaga"),
]


class ChatbotConnector(models.Model):
    """Information about the technology of the chatbot used, it can be used by multiple projects.

    Contains the used technology and the link to access the chatbot, also a name to identify it
    """

    # Name of the chatbot connector, must be unique per user
    name = models.CharField(max_length=255)
    technology = models.CharField(max_length=255, choices=CONNECTOR_CHOICES)
    link = models.URLField(blank=True)

    # Owner of the chatbot connector
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="chatbot_connectors", on_delete=models.CASCADE)

    class Meta:
        """Meta options for the ChatbotConnector model."""

        # Name should be unique per user
        unique_together: ClassVar[list[str]] = ["name", "owner"]

    def __str__(self) -> str:
        """Return the name of the chatbot connector."""
        return self.name


class TestCase(models.Model):
    """A Test Case is a execution of one or multiple test files.

    It contains the details of the execution, as well as the reports.
    """

    id = models.AutoField(primary_key=True)
    # Name of the test case
    name = models.CharField(max_length=255)
    # Timestamp of when the test case was executed
    executed_at = models.DateTimeField(auto_now_add=True)
    # STDOUT of the test case
    result = models.TextField(blank=True)
    # Separate stdout and stderr for Sensei execution (replaces result field)
    stdout = models.TextField(blank=True, help_text="Standard output from Sensei execution")
    stderr = models.TextField(blank=True, help_text="Standard error from Sensei execution")
    # Detailed error message for failed executions (parsed from stderr)
    error_message = models.TextField(blank=True, help_text="Parsed error message for user display")
    # Global execution time of the test case measured by the API, not the script
    execution_time = models.FloatField(blank=True, null=True)
    # If the execution was Successful, Failed or Running
    status = models.CharField(max_length=255, blank=True)
    # These are the user profiles used
    copied_files = models.JSONField(blank=True, null=True)
    # Test case belongs to only one project
    project = models.ForeignKey(Project, related_name="test_cases", on_delete=models.CASCADE)
    # Process ID of the test case, used to kill the process if needed
    process_id = models.IntegerField(blank=True, null=True)
    # Technology used
    technology = models.CharField(max_length=255, blank=True)

    # LLM Model information used for this test execution (snapshot at time of execution)
    llm_model = models.CharField(max_length=100, blank=True, help_text="LLM model used for this test execution")
    llm_provider = models.CharField(max_length=20, blank=True, help_text="LLM provider used for this test execution")

    # To be able to track the progress of the execution
    # Name of the profiles so we can access the directories
    profiles_names = models.JSONField(blank=True, null=True)
    # Celery task ID for tracking execution progress
    celery_task_id = models.CharField(
        max_length=255, blank=True, default="", help_text="Celery task ID for progress tracking"
    )
    # Number of total conversations
    total_conversations = models.IntegerField(blank=True, null=True)
    # Number of conversations that have already been
    executed_conversations = models.IntegerField(blank=True, null=True)

    class Meta:
        """Meta options for the TestCase model."""

        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["executed_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["project"]),
        ]

    def __str__(self) -> str:
        """Return a string representation of the TestCase."""
        return f"TestCase {self.id}"

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        """Save the TestCase instance."""
        # Save the test case, if given name is null, set it to TestCase <id>
        super().save(*args, **kwargs)

        if not self.name or not self.name.strip():
            self.name = f"TestCase {self.id}"
            super().save(update_fields=["name"])


# Delete test case directories when TestCase object is deleted from database
@receiver(post_delete, sender=TestCase)
def delete_test_case_directories(sender: type[TestCase], instance: TestCase, **_kwargs: Any) -> None:  # noqa: ANN401
    """Delete the test case directories when the TestCase is deleted."""
    try:
        # Get the user and project IDs
        user_id = instance.project.owner.id
        project_id = instance.project.id
        test_case_id = instance.id

        # Path to the profiles directory for this test case
        profiles_path = (
            Path(settings.MEDIA_ROOT)
            / "projects"
            / f"user_{user_id}"
            / f"project_{project_id}"
            / "profiles"
            / f"testcase_{test_case_id}"
        )

        # Path to the results directory for this test case
        results_path = (
            Path(settings.MEDIA_ROOT)
            / "results"
            / f"user_{user_id}"
            / f"project_{project_id}"
            / f"testcase_{test_case_id}"
        )

        # Delete profiles directory if it exists
        if profiles_path.exists():
            try:
                shutil.rmtree(profiles_path)
                logger.info("Deleted test case profiles directory: %s", profiles_path)
            except OSError:
                logger.exception("Error deleting test case profiles directory %s", profiles_path)

        # Delete results directory if it exists
        if results_path.exists():
            try:
                shutil.rmtree(results_path)
                logger.info("Deleted test case results directory: %s", results_path)
            except OSError:
                logger.exception("Error deleting test case results directory %s", results_path)

    except Exception:
        logger.exception("Error in delete_test_case_directories signal")


class GlobalReport(models.Model):
    """A Global Report contains the information generated by an execution of multiple test cases.

    Then it contains the different reports of the contained test cases.

    Contains:
    Average, minimum and maximum execution time.
    A collection of errors.
    """

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    avg_execution_time = models.FloatField(blank=True, null=True)
    min_execution_time = models.FloatField(blank=True, null=True)
    max_execution_time = models.FloatField(blank=True, null=True)
    total_cost = models.FloatField(blank=True, null=True)
    # Test report belongs to only one test case
    test_case = models.ForeignKey(TestCase, related_name="global_reports", on_delete=models.CASCADE)

    def __str__(self) -> str:
        """Return the name of the global report."""
        return self.name


class ProfileReport(models.Model):
    """A Test Report contains the information generated by a Test Case.

    Contains:
    Average, minimum and maximum execution time.
    A collection of errors.
    The conversation with all of the details.
    """

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    avg_execution_time = models.FloatField(blank=True, null=True)
    min_execution_time = models.FloatField(blank=True, null=True)
    max_execution_time = models.FloatField(blank=True, null=True)
    total_cost = models.FloatField(blank=True, null=True)

    # Conversation data
    serial = models.CharField(max_length=255)
    language = models.CharField(max_length=50)
    personality = models.CharField(max_length=255)
    context_details = models.JSONField()

    # Conversation specs
    interaction_style = models.JSONField()
    number_conversations = models.IntegerField()
    steps = models.IntegerField(blank=True, null=True)
    all_answered = models.JSONField(blank=True, null=True)

    # Test report belongs to only one global report
    global_report = models.ForeignKey(GlobalReport, related_name="profile_reports", on_delete=models.CASCADE)

    def __str__(self) -> str:
        """Return the name of the profile report."""
        return self.name


class Conversation(models.Model):
    """Conversation is a model to store the details generated by a conversation during a test case execution."""

    # Django Info
    id = models.AutoField(primary_key=True)
    profile_report = models.ForeignKey(ProfileReport, related_name="conversations", on_delete=models.CASCADE)

    # Basic Info
    name = models.CharField(max_length=255)

    # Test configuration
    ask_about = models.JSONField()

    # Results
    data_output = models.JSONField()
    errors = models.JSONField()
    total_cost = models.FloatField()
    conversation_time = models.FloatField()

    # Response Times
    response_times = models.JSONField()
    response_time_avg = models.FloatField()
    response_time_max = models.FloatField()
    response_time_min = models.FloatField()

    # Interaction History
    interaction = models.JSONField()

    def __str__(self) -> str:
        """Return the name of the conversation."""
        return self.name


class TestError(models.Model):
    """Test Error is a model to store the errors in a Test Report.

    contains the error code and the number of times it has occurred and the relative path of the conversation files with that error
    """

    id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=255)
    count = models.IntegerField()
    # Conversations stores the relative path of the conversation files with that error
    conversations = models.JSONField(blank=True, null=True)
    # Test error belongs to either a test report or a global report
    profile_report = models.ForeignKey(
        ProfileReport,
        related_name="test_errors",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )
    global_report = models.ForeignKey(
        GlobalReport,
        related_name="test_errors",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
    )

    def __str__(self) -> str:
        """Return the error code."""
        return self.code


# In your models.py
class ProfileGenerationTask(models.Model):
    """Model to track the progress of profile generation tasks."""

    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("SUCCESS", "Success"),
        ("FAILURE", "Failure"),
    )

    STAGE_CHOICES = (
        ("INITIALIZING", "Initializing generation"),
        ("GENERATING_CONVERSATIONS", "Generating conversations"),
        ("CREATING_PROFILES", "Creating profiles"),
        ("SAVING_FILES", "Saving generated files"),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    stage = models.CharField(max_length=25, choices=STAGE_CHOICES, blank=True)
    progress_percentage = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    error_message = models.TextField(blank=True)
    conversations = models.PositiveIntegerField(default=5)
    turns = models.PositiveIntegerField(default=5)
    generated_file_ids = models.JSONField(default=list)
    execution = models.ForeignKey(
        "ProfileExecution", on_delete=models.CASCADE, null=True, blank=True, related_name="generation_tasks"
    )
    celery_task_id = models.CharField(
        max_length=255, blank=True, default="", help_text="Celery task ID for progress tracking"
    )

    def __str__(self) -> str:
        """Return a string representation of the task."""
        return f"ProfileGenerationTask {self.id} for Project {self.project.name}"


class PersonalityFile(models.Model):
    """Model to store personality files in the personalities/ folder."""

    file = models.FileField(upload_to=upload_to_personalities)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey("Project", related_name="personality_files", on_delete=models.CASCADE)

    def __str__(self) -> str:
        """Return the base name of the file."""
        return Path(self.file.name).name

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        """Save the PersonalityFile instance."""
        if not self.name:
            self.name = Path(self.file.name).stem
        super().save(*args, **kwargs)


class RuleFile(models.Model):
    """Model to store rule files in the rules/ folder."""

    file = models.FileField(upload_to=upload_to_rules)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey("Project", related_name="rule_files", on_delete=models.CASCADE)

    def __str__(self) -> str:
        """Return the base name of the file."""
        return Path(self.file.name).name

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        """Save the RuleFile instance."""
        if not self.name:
            self.name = Path(self.file.name).stem
        super().save(*args, **kwargs)


class TypeFile(models.Model):
    """Model to store type files in the types/ folder."""

    file = models.FileField(upload_to=upload_to_types)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True)
    project = models.ForeignKey("Project", related_name="type_files", on_delete=models.CASCADE)

    def __str__(self) -> str:
        """Return the base name of the file."""
        return Path(self.file.name).name

    def save(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        """Save the TypeFile instance."""
        if not self.name:
            self.name = Path(self.file.name).stem
        super().save(*args, **kwargs)


class ProjectConfig(models.Model):
    """Model to store the run.yml configuration for each project."""

    project = models.OneToOneField("Project", related_name="config", on_delete=models.CASCADE)
    user_profile = models.CharField(max_length=255, blank=True)
    technology = models.CharField(max_length=255, blank=True)
    connector = models.CharField(max_length=255, blank=True)
    connector_parameters = models.JSONField(blank=True, null=True)
    extract_path = models.CharField(max_length=500, blank=True)
    execution_parameters = models.JSONField(blank=True, null=True, default=list)

    def __str__(self) -> str:
        """Return a string representation of the ProjectConfig."""
        return f"Config for {self.project.name}"


@receiver(post_delete, sender=PersonalityFile)
def delete_personality_file_from_media(
    sender: type[PersonalityFile],
    instance: PersonalityFile,
    **_kwargs: Any,  # noqa: ANN401
) -> None:
    """Delete the personality file from media when the PersonalityFile is deleted."""
    instance.file.delete(save=False)


@receiver(post_delete, sender=RuleFile)
def delete_rule_file_from_media(sender: type[RuleFile], instance: RuleFile, **_kwargs: Any) -> None:  # noqa: ANN401
    """Delete the rule file from media when the RuleFile is deleted."""
    instance.file.delete(save=False)


@receiver(post_delete, sender=TypeFile)
def delete_type_file_from_media(sender: type[TypeFile], instance: TypeFile, **_kwargs: Any) -> None:  # noqa: ANN401
    """Delete the file from media when the TypeFile is deleted."""
    try:
        if instance.file and Path(instance.file.path).exists():
            Path(instance.file.path).unlink()
            logger.info("Deleted file %s from media.", instance.file.path)
    except (FileNotFoundError, PermissionError, OSError):
        logger.exception("Error deleting file %s", instance.file.path)


class ProfileExecution(models.Model):
    """Represents a profile generation execution (TRACER or Manual)."""

    EXECUTION_TYPE_CHOICES: ClassVar[list[tuple[str, str]]] = [
        ("tracer", "TRACER"),
        ("manual", "Manual"),
    ]

    STATUS_CHOICES: ClassVar[list[tuple[str, str]]] = [
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("SUCCESS", "Success"),
        ("FAILURE", "Failure"),
    ]

    VERBOSITY_CHOICES: ClassVar[list[tuple[str, str]]] = [
        ("normal", "Normal"),
        ("verbose", "Verbose (-v)"),
        ("debug", "Debug (-vv)"),
    ]

    ERROR_TYPE_CHOICES: ClassVar[list[tuple[str, str]]] = [
        ("GRAPHVIZ_NOT_INSTALLED", "Graphviz Not Installed"),
        ("CONNECTOR_CONNECTION", "Connector Connection Error"),
        ("CONNECTOR_AUTHENTICATION", "Connector Authentication Error"),
        ("CONNECTOR_CONFIGURATION", "Connector Configuration Error"),
        ("CONNECTOR_RESPONSE", "Connector Response Error"),
        ("LLM_ERROR", "LLM Error"),
        ("TRACER_ERROR", "TRACER Error"),
        ("OTHER", "Other Error"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="profile_executions")
    execution_name = models.CharField(max_length=255)  # "TRACER_2024-01-16_11:30" or "Manual_2024-01-16_11:30"
    execution_type = models.CharField(max_length=20, choices=EXECUTION_TYPE_CHOICES)  # "tracer" or "manual"

    # TRACER specific parameters (null for manual)
    sessions = models.IntegerField(null=True, blank=True)  # TRACER sessions
    turns_per_session = models.IntegerField(null=True, blank=True)  # TRACER turns
    verbosity = models.CharField(
        max_length=10,
        choices=VERBOSITY_CHOICES,
        default="normal",
        blank=True,
        help_text="TRACER verbosity level for debugging",
    )  # TRACER verbosity level

    # Status and timing
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    execution_time_minutes = models.IntegerField(null=True, blank=True)

    # File organization
    profiles_directory = models.CharField(max_length=500)
    generated_profiles_count = models.IntegerField(default=0)

    # TRACER process output for debugging
    tracer_stdout = models.TextField(blank=True)
    tracer_stderr = models.TextField(blank=True)
    error_type = models.CharField(
        max_length=50,
        choices=ERROR_TYPE_CHOICES,
        blank=True,
        default="",
        help_text="Specific type of error encountered during TRACER execution.",
    )

    class Meta:
        """Meta options for the ProfileExecution model."""

        ordering: ClassVar[list[str]] = ["execution_type", "-created_at"]  # Manual first, then by date desc

    def __str__(self) -> str:
        """Return a string representation of the ProfileExecution."""
        return f"{self.execution_name} - {self.project.name}"

    @property
    def display_info(self) -> str:
        """Returns display info for the folder header."""
        if self.execution_type == "tracer":
            return f"({self.sessions} sessions, {self.turns_per_session} turns)"
        return f"({self.generated_profiles_count} profiles)"


class TracerAnalysisResult(models.Model):
    """Stores TRACER-specific analysis data (reports, graphs)."""

    execution = models.OneToOneField(ProfileExecution, on_delete=models.CASCADE, related_name="analysis_result")

    # TRACER output files
    report_file_path = models.CharField(max_length=500, blank=True, default="")  # report.md

    # Multiple graph format files
    workflow_graph_svg_path = models.CharField(max_length=500, blank=True, default="")  # workflow_graph.svg
    workflow_graph_png_path = models.CharField(max_length=500, blank=True, default="")  # workflow_graph.png
    workflow_graph_pdf_path = models.CharField(max_length=500, blank=True, default="")  # workflow_graph.pdf

    # Analysis metadata
    total_interactions = models.IntegerField(default=0)
    coverage_percentage = models.FloatField(null=True, blank=True)
    unique_paths_discovered = models.IntegerField(default=0)
    categories_count = models.IntegerField(default=0)
    estimated_cost_usd = models.FloatField(default=0.0)

    def __str__(self) -> str:
        """Return a string representation of the TracerAnalysisResult."""
        return f"Analysis for {self.execution.execution_name}"

    @property
    def has_any_graph(self) -> bool:
        """Return True if any graph format is available."""
        return bool(self.workflow_graph_svg_path or self.workflow_graph_png_path or self.workflow_graph_pdf_path)

    def get_available_formats(self) -> list[str]:
        """Return a list of available graph formats."""
        formats = []
        if self.workflow_graph_svg_path:
            formats.append("svg")
        if self.workflow_graph_png_path:
            formats.append("png")
        if self.workflow_graph_pdf_path:
            formats.append("pdf")
        return formats


class OriginalTracerProfile(models.Model):
    """Stores original TRACER-generated profiles for read-only viewing in dashboard."""

    execution = models.ForeignKey(ProfileExecution, on_delete=models.CASCADE, related_name="original_profiles")
    original_filename = models.CharField(max_length=255)
    original_content = models.TextField()  # Original YAML content
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        """Return a string representation of the OriginalTracerProfile."""
        return f"Original {self.original_filename} - {self.execution.execution_name}"

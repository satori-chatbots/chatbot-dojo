import logging
import os
import shutil

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

# Load FERNET SECRET KEY (it was loaded in the settings.py before)
FERNET_KEY = os.getenv("FERNET_SECRET_KEY")
if not FERNET_KEY:
    raise ValueError("FERNET_SECRET_KEY is not set in the environment!")

# Create cipher suite
cipher_suite = Fernet(FERNET_KEY)


class UserAPIKey(models.Model):
    """Model to store the API keys for the users

    It has a name, the encrypted API key and the user it belongs to
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="api_keys"
    )
    name = models.CharField(max_length=255)
    api_key_encrypted = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def set_api_key(self, api_key):
        """Encrypt and store the provided API key.
        """
        encrypted_key = cipher_suite.encrypt(api_key.encode())
        self.api_key_encrypted = encrypted_key.decode()
        self.save()

    def get_api_key(self):
        """Decrypt and return the stored API key.
        """
        if self.api_key_encrypted:
            return cipher_suite.decrypt(self.api_key_encrypted.encode()).decode()
        return None

    def __str__(self):
        return self.name


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is a required field")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    # Default model doesnt make it unique
    email = models.EmailField(max_length=255, unique=True)
    # Username doesnt really matter for now since we are using email as the main identifier
    username = models.CharField(max_length=255, blank=True, null=True)

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def set_api_key(self):
        """Encrypt and store the API Key
        """
        encrypted_key = cipher_suite.encrypt(self.api_key.encode())
        self.api_key = encrypted_key.decode()
        self.save()

    def get_api_key(self):
        """Decrypt and return the API Key
        """
        if self.api_key_encrypted:
            return cipher_suite.decrypt(self.api_key_encrypted.encode()).decode()
        return None


def upload_to(instance, filename):
    """Returns the path where the Test Files are stored (MEDIA_DIR/projects/user_{user_id}/project_{project_id}/profiles/file.yaml
    """
    # The test_name should have been set by the model's clean method
    # Get the user and project id
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/profiles/{filename}"


def upload_to_personalities(instance, filename):
    """Returns the path where the Personality files are stored
    """
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/personalities/{filename}"


def upload_to_rules(instance, filename):
    """Returns the path where the Rules files are stored
    """
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/rules/{filename}"


def upload_to_types(instance, filename):
    """Returns the path where the Types files are stored
    """
    user_id = instance.project.owner.id
    project_id = instance.project.id
    return f"projects/user_{user_id}/project_{project_id}/types/{filename}"


class TestFile(models.Model):
    """Model to store the uploaded User Profiles YAML files

    These are the models that are available to the user to run tests, each testfile belongs to a project
    Once the test is run, this file is copied to the project folder so that if this one is modified or even deleted, you can still see the original file that was used to run the test
    """

    file = models.FileField(upload_to=upload_to)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    project = models.ForeignKey(
        "Project", related_name="test_files", on_delete=models.CASCADE
    )
    is_valid = models.BooleanField(
        default=False,
        help_text="Whether the YAML file is valid for execution in Sensei",
    )
    # This shouldnt be necessary since we are making sure the file field is always relative
    # Anyway, I leave it as a comment in case we need to go back to it in the future
    # relative_path = models.CharField(max_length=255, blank=True, null=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # After saving, try to read and process the file
        if self.file and hasattr(self.file, "path") and os.path.exists(self.file.path):
            try:
                # First read the file for validation
                with open(self.file.path) as file:
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

                # Get the file extension
                _, ext = os.path.splitext(self.file.name)
                # Create new filename and change the extension to yaml
                # To avoid having yaml and yml files with the same name
                new_filename = f"{test_name}.yaml"
                # Get user and project id
                user_id = self.project.owner.id
                project_id = self.project.id
                new_path = f"projects/user_{user_id}/project_{project_id}/profiles/{new_filename}"

                # Rename the file
                old_path = self.file.path
                new_full_path = os.path.join(settings.MEDIA_ROOT, new_path)
                os.rename(old_path, new_full_path)

                # Update the model
                self.file.name = new_path
                self.name = test_name

                # Set validation status - only boolean flag
                self.is_valid = not bool(validation_errors)

                # Update all fields in the database
                TestFile.objects.filter(pk=self.pk).update(
                    file=self.file.name,
                    name=test_name,
                    is_valid=self.is_valid,
                )

            except yaml.YAMLError:
                # Set as invalid but don't raise exception
                self.is_valid = False
                TestFile.objects.filter(pk=self.pk).update(is_valid=False)
            except Exception:
                # Set as invalid but don't raise exception
                self.is_valid = False
                TestFile.objects.filter(pk=self.pk).update(is_valid=False)

    def __str__(self):
        return os.path.basename(self.file.name)


@receiver(post_delete, sender=TestFile)
def delete_file_from_media(sender, instance, **kwargs):
    """Delete the file from the media directory when the TestFile is deleted"""
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)


# Use post_save signal to set name after the file is saved
@receiver(post_save, sender=TestFile)
def set_name(sender, instance, created, **kwargs):
    """Set the name of the TestFile to the "test_name" field in the YAML file
    """
    # if created:
    #     # Extract 'test_name' from the YAML file
    #     try:
    #         with open(instance.file.path, "r") as file:
    #             data = yaml.safe_load(file)
    #             instance.name = data.get(
    #                 "test_name", os.path.basename(instance.file.name)
    #             )
    #     except yaml.YAMLError as e:
    #         print(f"Error loading YAML file: {e}")
    #         instance.name = os.path.basename(instance.file.name)

    #     # Save the updated instance without triggering another save signal
    #     sender.objects.filter(pk=instance.pk).update(name=instance.name)


class Project(models.Model):
    """A Project is a collection of test cases, it uses one chatbot technology
    """

    # Name of the project, must be unique for the user
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    # A project can only have one chatbot technology, but a technology can be used in multiple projects
    chatbot_technology = models.ForeignKey(
        "ChatbotTechnology", related_name="projects", on_delete=models.CASCADE
    )

    # Owner of the project
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="projects", on_delete=models.CASCADE
    )

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

    def __str__(self):
        return self.name

    def get_project_path(self):
        """Get the full filesystem path to the project folder
        """
        return os.path.join(
            settings.MEDIA_ROOT,
            "projects",
            f"user_{self.owner.id}",
            f"project_{self.id}",
        )

    def get_run_yml_path(self):
        """Get the path to the run.yml file for this project
        """
        return os.path.join(self.get_project_path(), "run.yml")

    def update_run_yml(self):
        """Update the run.yml file with current project configuration
        """
        config_data = {
            "project_folder": f"project_{self.id}",
            "user_profile": "",
            "technology": self.chatbot_technology.technology
            if self.chatbot_technology
            else "",
            "connector": self.chatbot_technology.link
            if self.chatbot_technology
            else "",
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
                    config_data["connector_parameters"] = (
                        self.config.connector_parameters
                    )
                if self.config.extract_path:
                    config_data["extract"] = self.config.extract_path
                if self.config.execution_parameters:
                    config_data["execution_parameters"] = (
                        self.config.execution_parameters
                    )
        except (AttributeError, TypeError):
            pass  # If config doesn't exist, use defaults

        run_yml_path = self.get_run_yml_path()
        os.makedirs(os.path.dirname(run_yml_path), exist_ok=True)

        try:
            with open(run_yml_path, "w") as f:
                yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)
            logger.info(f"Updated run.yml at {run_yml_path}")
        except Exception as e:
            logger.error(f"Error creating run.yml: {e}")


@receiver(post_delete, sender=Project)
def delete_project_directory(sender, instance, **kwargs):
    """Delete the entire project directory when the Project is deleted"""
    project_path = instance.get_project_path()
    if os.path.exists(project_path):
        try:
            shutil.rmtree(project_path)
            logger.info(f"Deleted project directory: {project_path}")
        except Exception as e:
            logger.error(f"Error deleting project directory {project_path}: {e}")


TECHNOLOGY_CHOICES = [
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


class ChatbotTechnology(models.Model):
    """Information about the technology of the chatbot used, it can be used by multiple projects

    Contains the used technology and the link to access the chatbot, also a name to identify it
    """

    # Name of the chatbot technology, must be unique
    name = models.CharField(max_length=255, unique=True)
    technology = models.CharField(max_length=255, choices=TECHNOLOGY_CHOICES)
    link = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.name


class TestCase(models.Model):
    """A Test Case is a execution of one or multiple test files

    It contains the details of the execution, as well as the reports.
    """

    id = models.AutoField(primary_key=True)
    # Name of the test case
    name = models.CharField(max_length=255)
    # Timestamp of when the test case was executed
    executed_at = models.DateTimeField(auto_now_add=True)
    # STDOUT of the test case
    result = models.TextField(blank=True, null=True)
    # Global execution time of the test case measured by the API, not the script
    execution_time = models.FloatField(blank=True, null=True)
    # If the execution was Successful, Failed or Running
    status = models.CharField(max_length=255, blank=True, null=True)
    # These are the user profiles used
    copied_files = models.JSONField(blank=True, null=True)
    # Test case belongs to only one project
    project = models.ForeignKey(
        Project, related_name="test_cases", on_delete=models.CASCADE
    )
    # Process ID of the test case, used to kill the process if needed
    process_id = models.IntegerField(blank=True, null=True)
    # Technology used
    technology = models.CharField(max_length=255, blank=True, null=True)

    # To be able to track the progress of the execution
    # Name of the profiles so we can access the directories
    profiles_names = models.JSONField(blank=True, null=True)
    # Number of total conversations
    total_conversations = models.IntegerField(blank=True, null=True)
    # Number of conversations that have already been
    executed_conversations = models.IntegerField(blank=True, null=True)

    def save(self, *args, **kwargs):
        # Save the test case, if given name is null, set it to TestCase <id>
        super().save(*args, **kwargs)

        if not self.name or not self.name.strip():
            self.name = f"TestCase {self.id}"
            super().save(update_fields=["name"])

    def __str__(self):
        return f"TestCase {self.id}"

    class Meta:
        indexes = [
            models.Index(fields=["executed_at"]),
            models.Index(fields=["status"]),
            models.Index(fields=["project"]),
        ]


# Delete test case directories when TestCase object is deleted from database
@receiver(post_delete, sender=TestCase)
def delete_test_case_directories(sender, instance, **kwargs):
    """Delete the test case directories when the TestCase is deleted"""
    try:
        # Get the user and project IDs
        user_id = instance.project.owner.id
        project_id = instance.project.id
        test_case_id = instance.id

        # Path to the profiles directory for this test case
        profiles_path = os.path.join(
            settings.MEDIA_ROOT,
            "projects",
            f"user_{user_id}",
            f"project_{project_id}",
            "profiles",
            f"testcase_{test_case_id}",
        )

        # Path to the results directory for this test case
        results_path = os.path.join(
            settings.MEDIA_ROOT,
            "results",
            f"user_{user_id}",
            f"project_{project_id}",
            f"testcase_{test_case_id}",
        )

        # Delete profiles directory if it exists
        if os.path.exists(profiles_path):
            try:
                shutil.rmtree(profiles_path)
                logger.info(f"Deleted test case profiles directory: {profiles_path}")
            except Exception as e:
                logger.error(
                    f"Error deleting test case profiles directory {profiles_path}: {e}"
                )

        # Delete results directory if it exists
        if os.path.exists(results_path):
            try:
                shutil.rmtree(results_path)
                logger.info(f"Deleted test case results directory: {results_path}")
            except Exception as e:
                logger.error(f"Error deleting test case results directory {results_path}: {e}")

    except Exception as e:
        logger.error(f"Error in delete_test_case_directories signal: {e}")


class GlobalReport(models.Model):
    """A Global Report contains the information generated by an execution of multiple test cases
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
    test_case = models.ForeignKey(
        TestCase, related_name="global_reports", on_delete=models.CASCADE
    )


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
    global_report = models.ForeignKey(
        GlobalReport, related_name="profile_reports", on_delete=models.CASCADE
    )


class Conversation(models.Model):
    """Conversation is a model to store the details generated by a conversation during a test case execution
    """

    # Django Info
    id = models.AutoField(primary_key=True)
    profile_report = models.ForeignKey(
        ProfileReport, related_name="conversations", on_delete=models.CASCADE
    )

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


class TestError(models.Model):
    """Test Error is a model to store the errors in a Test Report

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


# In your models.py
class ProfileGenerationTask(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("COMPLETED", "Completed"),
        ("ERROR", "Error"),
    )

    STAGE_CHOICES = (
        ("INITIALIZING", "Initializing generation"),
        ("GENERATING_CONVERSATIONS", "Generating conversations"),
        ("CREATING_PROFILES", "Creating profiles"),
        ("SAVING_FILES", "Saving generated files"),
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="PENDING")
    stage = models.CharField(
        max_length=25, choices=STAGE_CHOICES, blank=True, null=True
    )
    progress_percentage = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    error_message = models.TextField(blank=True, null=True)
    conversations = models.PositiveIntegerField(default=5)
    turns = models.PositiveIntegerField(default=5)
    generated_file_ids = models.JSONField(default=list)
    process_id = models.IntegerField(null=True, blank=True)


class PersonalityFile(models.Model):
    """Model to store personality files in the personalities/ folder
    """

    file = models.FileField(upload_to=upload_to_personalities)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    project = models.ForeignKey(
        "Project", related_name="personality_files", on_delete=models.CASCADE
    )

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = os.path.splitext(os.path.basename(self.file.name))[0]
        super().save(*args, **kwargs)

    def __str__(self):
        return os.path.basename(self.file.name)


class RuleFile(models.Model):
    """Model to store rule files in the rules/ folder
    """

    file = models.FileField(upload_to=upload_to_rules)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    project = models.ForeignKey(
        "Project", related_name="rule_files", on_delete=models.CASCADE
    )

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = os.path.splitext(os.path.basename(self.file.name))[0]
        super().save(*args, **kwargs)

    def __str__(self):
        return os.path.basename(self.file.name)


class TypeFile(models.Model):
    """Model to store type files in the types/ folder
    """

    file = models.FileField(upload_to=upload_to_types)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    project = models.ForeignKey(
        "Project", related_name="type_files", on_delete=models.CASCADE
    )

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = os.path.splitext(os.path.basename(self.file.name))[0]
        super().save(*args, **kwargs)

    def __str__(self):
        return os.path.basename(self.file.name)


class ProjectConfig(models.Model):
    """Model to store the run.yml configuration for each project
    """

    project = models.OneToOneField(
        "Project", related_name="config", on_delete=models.CASCADE
    )
    user_profile = models.CharField(max_length=255, blank=True, null=True)
    technology = models.CharField(max_length=255, blank=True, null=True)
    connector = models.CharField(max_length=255, blank=True, null=True)
    connector_parameters = models.JSONField(blank=True, null=True)
    extract_path = models.CharField(max_length=500, blank=True, null=True)
    execution_parameters = models.JSONField(blank=True, null=True, default=list)

    def __str__(self):
        return f"Config for {self.project.name}"


@receiver(post_delete, sender=PersonalityFile)
def delete_personality_file_from_media(sender, instance, **kwargs):
    """Delete the file from the media directory when the PersonalityFile is deleted"""
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)


@receiver(post_delete, sender=RuleFile)
def delete_rule_file_from_media(sender, instance, **kwargs):
    """Delete the file from the media directory when the RuleFile is deleted"""
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)


@receiver(post_delete, sender=TypeFile)
def delete_type_file_from_media(sender, instance, **kwargs):
    """Delete the file from the media directory when the TypeFile is deleted"""
    if instance.file:
        if os.path.isfile(instance.file.path):
            os.remove(instance.file.path)

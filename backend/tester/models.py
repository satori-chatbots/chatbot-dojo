from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
import os
import yaml


def upload_to(instance, filename):
    """
    Returns the path where the Test Files are stored (MEDIA_DIR/user-profiles/<project_id>/<filename>)
    """
    return os.path.join("user-profiles", str(instance.project.id), filename)


class TestFile(models.Model):
    """
    Model to store the uploaded User Profiles YAML files

    These are the models that are available to the user to run tests, each testfile belongs to a project
    Once the test is run, this file is copied to the project folder so that if this one is modified or even deleted, you can still see the original file that was used to run the test
    """

    file = models.FileField(upload_to=upload_to)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    project = models.ForeignKey(
        "Project", related_name="test_files", on_delete=models.CASCADE
    )

    # This shouldnt be necessary since we are making sure the file field is always relative
    # Anyway, I leave it as a comment in case we need to go back to it in the future
    # relative_path = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return os.path.basename(self.file.name)


# Delete file from media when TestFile object is deleted from database
@receiver(post_delete, sender=TestFile)
def delete_file_from_media(sender, instance, **kwargs):
    """
    Delete the file from the media folder when the TestFile object is deleted
    """
    instance.file.delete(save=False)


# Use post_save signal to set name after the file is saved
@receiver(post_save, sender=TestFile)
def set_name(sender, instance, created, **kwargs):
    """
    Set the name of the TestFile to the "test_name" field in the YAML file
    """
    if created:
        # Extract 'test_name' from the YAML file
        try:
            with open(instance.file.path, "r") as file:
                data = yaml.safe_load(file)
                instance.name = data.get(
                    "test_name", os.path.basename(instance.file.name)
                )
        except yaml.YAMLError as e:
            print(f"Error loading YAML file: {e}")
            instance.name = os.path.basename(instance.file.name)

        # Save the updated instance without triggering another save signal
        sender.objects.filter(pk=instance.pk).update(name=instance.name)


class Project(models.Model):
    """
    A Project is a collection of test cases, it uses one chatbot technology
    """

    # Name of the project, must be unique
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # A project can only have one chatbot technology, but a technology can be used in multiple projects
    chatbot_technology = models.ForeignKey(
        "ChatbotTechnology", related_name="projects", on_delete=models.CASCADE
    )

    def __str__(self):
        return self.name


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
    link = models.URLField()

    def __str__(self):
        return self.name


class TestCase(models.Model):
    """
    A Test Case is a execution of one or multiple test files

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

    def save(self, *args, **kwargs):
        # Save the test case, if given name is null, set it to TestCase <id>
        creating = self.pk is None
        super().save(*args, **kwargs)

        if not self.name or not self.name.strip():
            self.name = f"TestCase {self.id}"
            super().save(update_fields=["name"])

    def __str__(self):
        return f"TestCase {self.id}"


class GlobalReport(models.Model):
    """
    A Global Report contains the information generated by an execution of multiple test cases
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
    """
    A Test Report contains the information generated by a Test Case.

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
    """
    Conversation is a model to store the details generated by a conversation during a test case execution
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
    """
    Test Error is a model to store the errors in a Test Report

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

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
import os
import yaml

def upload_to(instance, filename):
    return os.path.join('user-yaml', filename)

class TestFile(models.Model):
    file = models.FileField(upload_to=upload_to)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    relative_path = models.CharField(max_length=255, blank=True, null=True)
    name = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return os.path.basename(self.file.name)

# Delete file from media when TestFile object is deleted from database
@receiver(post_delete, sender=TestFile)
def delete_file_from_media(sender, instance, **kwargs):
    instance.file.delete(save=False)

# Use post_save signal to set relative_path and name after the file is saved
@receiver(post_save, sender=TestFile)
def set_relative_path_and_name(sender, instance, created, **kwargs):
    if created:
        # Ensure the file exists before processing
        if instance.file and os.path.exists(instance.file.path):
            # Set relative_path relative to MEDIA_ROOT
            instance.relative_path = os.path.relpath(instance.file.path, settings.MEDIA_ROOT)

            # Extract 'test_name' from the YAML file
            try:
                with open(instance.file.path, 'r') as file:
                    data = yaml.safe_load(file)
                    instance.name = data.get('test_name', os.path.basename(instance.file.name))
            except yaml.YAMLError as e:
                print(f"Error loading YAML file: {e}")
                instance.name = os.path.basename(instance.file.name)

            # Save the updated instance without triggering another save signal
            sender.objects.filter(pk=instance.pk).update(relative_path=instance.relative_path, name=instance.name)

class TestCase(models.Model):
    id = models.AutoField(primary_key=True)
    executed_at = models.DateTimeField(auto_now_add=True)
    result = models.TextField(blank=True, null=True)
    execution_time = models.FloatField(blank=True, null=True)
    test_files = models.ManyToManyField(TestFile, related_name='test_cases', blank=True)
    copied_files = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"TestCase {self.id}"

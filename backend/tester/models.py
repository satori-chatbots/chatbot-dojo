from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
import os

def upload_to(instance, filename):
    return os.path.join('user-yaml', filename)

class TestFile(models.Model):
    file = models.FileField(upload_to=upload_to)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    relative_path = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return os.path.basename(self.file.name)

    def save(self, *args, **kwargs):
        # Set relative_path to the file's relative path
        if self.file and self.file.name:
            self.relative_path = os.path.relpath(self.file.path, settings.MEDIA_ROOT)
        super().save(*args, **kwargs)

# Delete file from media when TestFile object is deleted from database
@receiver(post_delete, sender=TestFile)
def delete_file_from_media(sender, instance, **kwargs):
    instance.file.delete(save=False)

class TestCase(models.Model):
    id = models.AutoField(primary_key=True)
    executed_at = models.DateTimeField(auto_now_add=True)
    result = models.TextField(blank=True, null=True)
    execution_time = models.FloatField(blank=True, null=True)
    test_files = models.ManyToManyField(TestFile, related_name='test_cases', blank=True)
    copied_files = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"TestCase {self.id}"

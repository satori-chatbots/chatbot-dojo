from django.db import models

def upload_to(instance, filename):
    return f'user-yaml/{filename}'

class TestFile(models.Model):
    file = models.FileField(upload_to=upload_to)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file.name

class TestCase(models.Model):
    id = models.AutoField(primary_key=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    result = models.TextField(blank=True, null=True)
    execution_time = models.FloatField(blank=True, null=True)
    test_files = models.ManyToManyField(TestFile, related_name='test_cases', blank=True)

    def __str__(self):
        return f"TestCase created at {self.uploaded_at}"

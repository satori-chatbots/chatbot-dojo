from django.db import models

def upload_to(instance, filename):
    return f'uploads/user-yaml/{filename}'

class TestCase(models.Model):
    id = models.AutoField(primary_key=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    result = models.TextField(blank=True, null=True)
    execution_time = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"TestCase created at {self.uploaded_at}"

class TestFile(models.Model):
    file = models.FileField(upload_to=upload_to)
    test_case = models.ForeignKey(TestCase, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return self.file.name

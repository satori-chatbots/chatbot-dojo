from django.db import models

class TestCase(models.Model):
    uploaded_at = models.DateTimeField(auto_now_add=True)
    result = models.TextField(blank=True, null=True)
    execution_time = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"TestCase created at {self.uploaded_at}"

class TestFile(models.Model):
    file = models.FileField(upload_to='test_files/')
    test_case = models.ForeignKey(TestCase, on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return self.file.name

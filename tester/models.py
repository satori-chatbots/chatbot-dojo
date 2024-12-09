from django.db import models

class TestFile(models.Model):
    file = models.FileField(upload_to='uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    result = models.TextField(blank=True, null=True)
    execution_time = models.FloatField(blank=True, null=True)

    def __str__(self):
        return f"File uploaded at {self.uploaded_at}"

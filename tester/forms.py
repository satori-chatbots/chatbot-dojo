from django import forms
from .models import TestFile

class TestFileForm(forms.ModelForm):
    class Meta:
        model = TestFile
        fields = ('file',)

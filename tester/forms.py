from django import forms
from django.forms import ClearableFileInput
from .models import TestCase, TestFile

class TestCaseForm(forms.ModelForm):
    class Meta:
        model = TestCase
        fields = []

class TestFileForm(forms.ModelForm):
    class Meta:
        model = TestFile
        fields = ['file']

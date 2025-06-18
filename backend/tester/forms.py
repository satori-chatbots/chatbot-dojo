from django import forms
from django.forms import ClearableFileInput
from .models import TestCase, TestFile


# https://forum.djangoproject.com/t/multiple-image-upload-like-an-e-commerce-application-handling-djangos-fileinput-doesnt-support-multiple-files/34719
class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        print(">>>", data, initial)
        single_file_clean = super().clean
        if isinstance(data, (list, tuple)):
            result = [single_file_clean(d, initial) for d in data]
        else:
            result = [single_file_clean(data, initial)]
        return result


class TestCaseForm(forms.ModelForm):
    class Meta:
        model = TestCase
        fields = []


class TestFileForm(forms.ModelForm):
    file = MultipleFileField()

    class Meta:
        model = TestFile
        fields = ["file"]

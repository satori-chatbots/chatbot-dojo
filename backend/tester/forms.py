import logging

from django import forms

from .models import TestCase, TestFile

logger = logging.getLogger(__name__)


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        logger.debug(f"MultipleFileField.clean called with data={data}, initial={initial}")
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

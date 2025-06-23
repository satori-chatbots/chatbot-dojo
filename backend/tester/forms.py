"""Forms for the tester app."""

import logging
from typing import Any, ClassVar

from django import forms

from .models import TestCase, TestFile

logger = logging.getLogger(__name__)


class MultipleFileInput(forms.ClearableFileInput):
    """A custom file input widget that allows multiple file selection."""

    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    """A custom form field that can handle multiple file uploads."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:  # noqa: ANN401
        """Initialize the MultipleFileField."""
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data: Any, initial: Any | None = None) -> list[Any]:  # noqa: ANN401
        """Clean the field data, handling multiple files.

        It processes a list of uploaded files and cleans each one individually.
        """
        logger.debug("MultipleFileField.clean called with data=%s, initial=%s", data, initial)
        single_file_clean = super().clean
        if isinstance(data, list | tuple):
            result = [single_file_clean(d, initial) for d in data]
        else:
            result = single_file_clean(data, initial)
        return result


class TestCaseForm(forms.ModelForm):
    """A form for creating TestCase instances."""

    class Meta:
        """Meta options for the TestCaseForm."""

        model = TestCase
        fields: ClassVar[list[str]] = []


class TestFileForm(forms.ModelForm):
    """A form for uploading multiple TestFile instances."""

    file = MultipleFileField()

    class Meta:
        """Meta options for the TestFileForm."""

        model = TestFile
        fields: ClassVar[list[str]] = ["file"]

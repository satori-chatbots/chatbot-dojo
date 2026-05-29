"""Add modification timestamps to provenance-enabled artifacts."""

from typing import ClassVar

from django.db import migrations, models
from django.db.migrations.operations.base import Operation
from django.utils import timezone

PROVENANCE_MODELS = [
    "chatbotconnector",
    "personalityfile",
    "project",
    "rulefile",
    "senseicheckrule",
    "testfile",
    "typefile",
]


class Migration(migrations.Migration):
    """Persist last modification timestamps for artifact provenance."""

    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("tester", "0021_artifact_provenance"),
    ]

    operations: ClassVar[list[Operation]] = [
        migrations.AddField(
            model_name="chatbotconnector",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, default=timezone.now),
            preserve_default=False,
        ),
    ] + [
        migrations.AddField(
            model_name=model_name,
            name="last_modified_at",
            field=models.DateTimeField(default=timezone.now),
        )
        for model_name in PROVENANCE_MODELS
    ]

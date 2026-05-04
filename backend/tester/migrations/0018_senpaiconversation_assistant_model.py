"""Add assistant model selection to Senpai conversations."""

from django.db import migrations, models


class Migration(migrations.Migration):
    """Persist the selected model used by the Senpai assistant."""

    dependencies = [
        ("tester", "0017_rename_connector_exports_to_connector_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="senpaiconversation",
            name="assistant_model",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]

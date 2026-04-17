"""Add assistant API key selection to Senpai conversations."""

from django.db import migrations, models


class Migration(migrations.Migration):
    """Attach a selected user API key to the Senpai conversation."""

    dependencies = [
        ("tester", "0011_senpaiconversation"),
    ]

    operations = [
        migrations.AddField(
            model_name="senpaiconversation",
            name="assistant_api_key",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="senpai_conversations",
                to="tester.userapikey",
            ),
        ),
    ]

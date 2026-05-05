from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tester", "0019_senpai_conversation_history"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profilegenerationtask",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("RUNNING", "Running"),
                    ("SUCCESS", "Success"),
                    ("FAILURE", "Failure"),
                    ("CANCELLING", "Cancelling"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="PENDING",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="profileexecution",
            name="process_id",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="profilegenerationtask",
            name="stage",
            field=models.CharField(
                blank=True,
                choices=[
                    ("INITIALIZING", "Initializing generation"),
                    ("GENERATING_CONVERSATIONS", "Generating conversations"),
                    ("CREATING_PROFILES", "Creating profiles"),
                    ("SAVING_FILES", "Saving generated files"),
                    ("CANCELLED", "Cancelled"),
                ],
                max_length=255,
            ),
        ),
        migrations.AlterField(
            model_name="profileexecution",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("RUNNING", "Running"),
                    ("SUCCESS", "Success"),
                    ("FAILURE", "Failure"),
                    ("CANCELLING", "Cancelling"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
    ]

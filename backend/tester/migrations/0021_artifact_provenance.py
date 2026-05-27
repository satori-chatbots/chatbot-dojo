from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


PROVENANCE_MODELS = [
    "chatbotconnector",
    "personalityfile",
    "project",
    "rulefile",
    "senseicheckrule",
    "testfile",
    "typefile",
]

SOURCE_CHOICES = [
    ("user", "User"),
    ("senpai_assistant", "Senpai Assistant"),
    ("tracer", "TRACER"),
    ("system", "System"),
    ("unknown", "Unknown"),
]


def provenance_fields(model_name):
    return [
        migrations.AddField(
            model_name=model_name,
            name="created_by_source",
            field=models.CharField(choices=SOURCE_CHOICES, db_index=True, default="user", max_length=32),
        ),
        migrations.AddField(
            model_name=model_name,
            name="last_modified_by_source",
            field=models.CharField(choices=SOURCE_CHOICES, db_index=True, default="user", max_length=32),
        ),
        migrations.AddField(
            model_name=model_name,
            name="created_by_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name=model_name,
            name="last_modified_by_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name=model_name,
            name="created_by_senpai_conversation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="tester.senpaiconversation",
            ),
        ),
        migrations.AddField(
            model_name=model_name,
            name="last_modified_by_senpai_conversation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="tester.senpaiconversation",
            ),
        ),
        migrations.AddField(
            model_name=model_name,
            name="provenance_metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]


def backfill_provenance(apps, _schema_editor):
    ChatbotConnector = apps.get_model("tester", "ChatbotConnector")
    PersonalityFile = apps.get_model("tester", "PersonalityFile")
    Project = apps.get_model("tester", "Project")
    RuleFile = apps.get_model("tester", "RuleFile")
    SenseiCheckRule = apps.get_model("tester", "SenseiCheckRule")
    TestFile = apps.get_model("tester", "TestFile")
    TypeFile = apps.get_model("tester", "TypeFile")

    for connector in ChatbotConnector.objects.only("id", "owner_id").iterator():
        connector.created_by_source = "user"
        connector.last_modified_by_source = "user"
        connector.created_by_user_id = connector.owner_id
        connector.last_modified_by_user_id = connector.owner_id
        connector.save(
            update_fields=[
                "created_by_source",
                "last_modified_by_source",
                "created_by_user",
                "last_modified_by_user",
            ]
        )

    for project in Project.objects.only("id", "owner_id").iterator():
        project.created_by_source = "user"
        project.last_modified_by_source = "user"
        project.created_by_user_id = project.owner_id
        project.last_modified_by_user_id = project.owner_id
        project.save(
            update_fields=[
                "created_by_source",
                "last_modified_by_source",
                "created_by_user",
                "last_modified_by_user",
            ]
        )

    project_file_models = (PersonalityFile, RuleFile, SenseiCheckRule, TypeFile)
    for model in project_file_models:
        for artifact in model.objects.select_related("project").only("id", "project__owner_id").iterator():
            artifact.created_by_source = "user"
            artifact.last_modified_by_source = "user"
            artifact.created_by_user_id = artifact.project.owner_id
            artifact.last_modified_by_user_id = artifact.project.owner_id
            artifact.save(
                update_fields=[
                    "created_by_source",
                    "last_modified_by_source",
                    "created_by_user",
                    "last_modified_by_user",
                ]
            )

    for test_file in TestFile.objects.select_related("project", "execution").only(
        "id",
        "project__owner_id",
        "execution__execution_type",
    ):
        source = "tracer" if test_file.execution and test_file.execution.execution_type == "tracer" else "user"
        test_file.created_by_source = source
        test_file.last_modified_by_source = source
        test_file.created_by_user_id = test_file.project.owner_id
        test_file.last_modified_by_user_id = test_file.project.owner_id
        test_file.save(
            update_fields=[
                "created_by_source",
                "last_modified_by_source",
                "created_by_user",
                "last_modified_by_user",
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tester", "0020_tracer_cancellation"),
    ]

    operations = [
        *[operation for model_name in PROVENANCE_MODELS for operation in provenance_fields(model_name)],
        migrations.RunPython(backfill_provenance, migrations.RunPython.noop),
    ]

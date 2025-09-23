# Generated migration to move sensei check rules from sensei_check_rules to rules directory

import os
from pathlib import Path
from django.db import migrations
from django.conf import settings


def move_sensei_check_rules_files(apps, schema_editor):
    """Move sensei check rules files from sensei_check_rules to rules directory."""
    SenseiCheckRule = apps.get_model('tester', 'SenseiCheckRule')

    for rule in SenseiCheckRule.objects.all():
        if rule.file and rule.file.name:
            old_path = Path(settings.MEDIA_ROOT) / rule.file.name

            # Update the file path from sensei_check_rules to rules
            new_file_name = rule.file.name.replace('/sensei_check_rules/', '/rules/')
            new_path = Path(settings.MEDIA_ROOT) / new_file_name

            # Create the new directory if it doesn't exist
            new_path.parent.mkdir(parents=True, exist_ok=True)

            # Move the file if the old file exists
            if old_path.exists():
                # Move the file to the new location
                old_path.rename(new_path)

                # Update the database record
                rule.file.name = new_file_name
                rule.save(update_fields=['file'])

                # Remove the old directory if it's empty
                try:
                    old_path.parent.rmdir()
                except OSError:
                    # Directory not empty or doesn't exist, that's fine
                    pass


def reverse_move_sensei_check_rules_files(apps, schema_editor):
    """Reverse the migration by moving files back to sensei_check_rules directory."""
    SenseiCheckRule = apps.get_model('tester', 'SenseiCheckRule')

    for rule in SenseiCheckRule.objects.all():
        if rule.file and rule.file.name:
            old_path = Path(settings.MEDIA_ROOT) / rule.file.name

            # Update the file path from rules to sensei_check_rules
            new_file_name = rule.file.name.replace('/rules/', '/sensei_check_rules/')
            new_path = Path(settings.MEDIA_ROOT) / new_file_name

            # Create the new directory if it doesn't exist
            new_path.parent.mkdir(parents=True, exist_ok=True)

            # Move the file if the old file exists
            if old_path.exists():
                # Move the file to the new location
                old_path.rename(new_path)

                # Update the database record
                rule.file.name = new_file_name
                rule.save(update_fields=['file'])

                # Remove the old directory if it's empty
                try:
                    old_path.parent.rmdir()
                except OSError:
                    # Directory not empty or doesn't exist, that's fine
                    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tester', '0007_senseicheckrule'),
    ]

    operations = [
        migrations.RunPython(
            move_sensei_check_rules_files,
            reverse_move_sensei_check_rules_files
        ),
    ]

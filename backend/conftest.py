"""Pytest cleanup helpers for the backend test suite."""

import os
from pathlib import Path
from typing import Any

import django
from django.apps import apps
from django.test.runner import DiscoverRunner


def pytest_configure(config: Any) -> None:  # noqa: ANN401
    """Configure Django before pytest imports Django-dependent modules."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "senseiweb.settings")
    os.environ.setdefault("SECRET_KEY", "pytest-secret-key")
    os.environ.setdefault("FERNET_SECRET_KEY", "otPjnFEt9CA64nDid7Bamyi2qcSRG4E_fOHNDuviMx0=")
    if not apps.ready:
        django.setup()

    runner = DiscoverRunner(verbosity=0, interactive=False)
    runner.setup_test_environment()
    old_config = runner.setup_databases()
    config._django_runner = runner  # noqa: SLF001
    config._django_old_config = old_config  # noqa: SLF001


def pytest_unconfigure(config: Any) -> None:  # noqa: ANN401
    """Tear down Django's test database after pytest finishes."""
    runner = getattr(config, "_django_runner", None)
    old_config = getattr(config, "_django_old_config", None)
    if runner is None or old_config is None:
        return
    runner.teardown_databases(old_config)
    runner.teardown_test_environment()


def _remove_empty_repo_tmp_dirs() -> None:
    """Remove abandoned empty tempfile directories from the repository root."""
    repo_root = Path(__file__).resolve().parent.parent

    for path in repo_root.glob("tmp*"):
        if not path.is_dir():
            continue
        try:
            next(path.iterdir())
        except StopIteration:
            path.rmdir()
        except OSError:
            continue


def pytest_sessionstart(session: object) -> None:
    """Clean leftovers from previous interrupted test runs."""
    _remove_empty_repo_tmp_dirs()


def pytest_sessionfinish(session: object, exitstatus: int) -> None:
    """Clean tempfile directories that were left empty after tests."""
    _remove_empty_repo_tmp_dirs()

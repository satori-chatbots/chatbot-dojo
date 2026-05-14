"""Pytest cleanup helpers for the backend test suite."""

from pathlib import Path


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

"""Base module with common imports and utilities for the tester API."""

import logging
import re
import sys
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model

# Get the latest version of the user model
User = get_user_model()

# Setup logging
logger = logging.getLogger(__name__)

# Import the RoleData class from user-simulator (Sensei)
# Use pathlib for modern path manipulation
base_dir = Path(settings.BASE_DIR).parent
sys.path.append(str(base_dir / "user-simulator" / "src"))


def extract_test_name_from_malformed_yaml(content: bytes) -> str | None:
    """Extract test_name from potentially malformed YAML using regex.

    Returns None if no test_name is found.
    """
    try:
        # Look for test_name: "value" or test_name: 'value' or test_name: value
        pattern = r'test_name:\s*[\'"]?([\w\d_-]+)[\'"]?'
        # The content is bytes, so it needs to be decoded for regex matching.
        match = re.search(pattern, content.decode("utf-8"))
        if match:
            return match.group(1)
    except (AttributeError, UnicodeDecodeError) as e:
        # This can happen if content is not bytes or has an encoding error.
        # We log this for debugging but return None as the function is designed
        # to fail gracefully.
        logger.debug("Could not extract test_name from content: %s", e)
    return None

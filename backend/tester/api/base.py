"""Base module with common imports and utilities for the tester API."""

import logging
import os
import re
import sys

from django.conf import settings
from django.contrib.auth import get_user_model

# Get the latest version of the user model
User = get_user_model()

# Setup logging
logger = logging.getLogger(__name__)

# Import the RoleData class from user-simulator (Sensei)
base_dir = os.path.dirname(settings.BASE_DIR)
sys.path.append(os.path.join(base_dir, "user-simulator", "src"))


def extract_test_name_from_malformed_yaml(content):
    """Extract test_name from potentially malformed YAML using regex.
    Returns None if no test_name is found.
    """
    try:
        # Look for test_name: "value" or test_name: 'value' or test_name: value
        pattern = r'test_name:\s*[\'"]?([\w\d_-]+)[\'"]?'
        match = re.search(pattern, content.decode("utf-8"))
        if match:
            return match.group(1)
    except Exception:
        pass
    return None

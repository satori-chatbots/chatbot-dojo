"""Utility functions for key management and environment setup."""

import configparser
import logging
import os
from pathlib import Path

logger = logging.getLogger("Info Logger")


def check_keys(key_list: list) -> None:
    """Check for required keys in the environment, loading from a properties file if available.

    Args:
        key_list (list): List of required environment variable keys.

    Raises:
        KeyNotFoundError: If any required key is missing from the environment.
    """
    if Path("keys.properties").exists():
        logger.info("properties found!")
        config = configparser.ConfigParser()
        config.read("keys.properties")

        # Loop over all keys and values
        for key_name in config["keys"]:
            key_upper = key_name.upper()
            os.environ[key_upper] = config["keys"][key_name]

    for k in key_list:
        if not os.environ.get(k):
            error_msg = f"{k} not found"
            raise KeyNotFoundError(error_msg)


class KeyNotFoundError(Exception):
    """Custom exception for missing environment keys."""

import os
import configparser
import logging

logger = logging.getLogger('Info Logger')

def check_keys(key_list: list):
    if os.path.exists("keys.properties"):
        logger.info("properties found!")
        config = configparser.ConfigParser()
        config.read('keys.properties')

        # Loop over all keys and values
        for key in config['keys']:
            key = key.upper()
            os.environ[key] = config['keys'][key]

    for k in key_list:
        if not os.environ.get(k):
            raise Exception(f"{k} not found")

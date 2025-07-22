import os
import secrets
import string
from django.core.management.utils import get_random_secret_key
from cryptography.fernet import Fernet


def generate_django_secret_key():
    """
    Generates a cryptographically strong secret key using Django's utility.
    """
    return get_random_secret_key()


def generate_fernet_key():
    """
    Generates a Fernet key for encryption using the cryptography library.
    """
    return Fernet.generate_key().decode()


def generate_secure_password(length=16):
    """
    Generates a cryptographically strong password.
    """
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def main():
    """
    Prompts the user to choose an environment and creates the corresponding
    .env file with securely generated values.
    """
    while True:
        env_choice = input(
            "Which environment file do you want to create? (dev/prod): "
        ).lower()
        if env_choice in ["dev", "prod"]:
            break
        print("Invalid input. Please enter 'dev' or 'prod'.")

    is_production = env_choice == "prod"
    # The script is in /scripts, so the project root is one level up
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if is_production:
        print("Generating secure keys and passwords for production environment...")
        env_file_path = os.path.join(project_root, ".env")
        config = {
            # Django Configuration
            "DEBUG": "False",
            "SECRET_KEY": generate_django_secret_key(),
            # Database Configuration
            "POSTGRES_DB": "senseiweb_prod",
            "POSTGRES_USER": "senseiweb_prod_user",
            "POSTGRES_PASSWORD": generate_secure_password(),
            "POSTGRES_HOST": "db",
            "POSTGRES_PORT": "5432",
            # RabbitMQ Configuration
            "RABBITMQ_HOST": "rabbitmq",
            "RABBITMQ_PORT": "5672",
            "RABBITMQ_USER": "sensei_prod_mq_user",
            "RABBITMQ_PASSWORD": generate_secure_password(),
            "RABBITMQ_VHOST": "/",
            # Celery Configuration
            "CELERY_RESULT_BACKEND": "rpc://",
            # Django Configuration
            "ALLOWED_HOSTS": "localhost,backend,127.0.0.1",
            "CORS_ALLOWED_ORIGINS": "http://localhost,http://127.0.0.1",
            # Application Configuration
            "FILEVAULT_ROOT": "/app/filevault",
            "FERNET_SECRET_KEY": generate_fernet_key(),
        }
    else:
        env_file_path = os.path.join(project_root, ".env.dev")
        config = {
            # .env.dev
            "DEBUG": "True",
            "SECRET_KEY": generate_django_secret_key(),
            # Database Configuration
            "POSTGRES_DB": "senseiweb_dev",
            "POSTGRES_USER": "senseiweb_dev_user",
            "POSTGRES_PASSWORD": "sensei_passwd_dev",
            "POSTGRES_HOST": "db",
            "POSTGRES_PORT": "5432",
            # RabbitMQ Configuration
            "RABBITMQ_HOST": "rabbitmq",
            "RABBITMQ_PORT": "5672",
            "RABBITMQ_USER": "sensei_dev_mq_user",
            "RABBITMQ_PASSWORD": generate_secure_password(),
            "RABBITMQ_VHOST": "/",
            # Celery Configuration
            "CELERY_RESULT_BACKEND": "rpc://",
            # Django Configuration
            "ALLOWED_HOSTS": "localhost,backend,127.0.0.1",
            "CORS_ALLOWED_ORIGINS": "http://localhost,http://127.0.0.1,http://localhost:5173",
            # Application Configuration
            "FILEVAULT_ROOT": "/app/filevault",
            "FERNET_SECRET_KEY": generate_fernet_key(),
            "UV_CACHE_DIR": "/app/.uv-cache",
        }

    file_content = f"""# Django Configuration
DEBUG={config.get("DEBUG")}
SECRET_KEY={config.get("SECRET_KEY")}

# Database Configuration
POSTGRES_DB={config.get("POSTGRES_DB")}
POSTGRES_USER={config.get("POSTGRES_USER")}
POSTGRES_PASSWORD={config.get("POSTGRES_PASSWORD")}
POSTGRES_HOST={config.get("POSTGRES_HOST")}
POSTGRES_PORT={config.get("POSTGRES_PORT")}

# RabbitMQ Configuration
RABBITMQ_HOST={config.get("RABBITMQ_HOST")}
RABBITMQ_PORT={config.get("RABBITMQ_PORT")}
RABBITMQ_USER={config.get("RABBITMQ_USER")}
RABBITMQ_PASSWORD={config.get("RABBITMQ_PASSWORD")}
RABBITMQ_VHOST={config.get("RABBITMQ_VHOST")}

# Celery Configuration (will be built from RabbitMQ settings above)
CELERY_RESULT_BACKEND={config.get("CELERY_RESULT_BACKEND")}

# Django Configuration
ALLOWED_HOSTS={config.get("ALLOWED_HOSTS")}
CORS_ALLOWED_ORIGINS={config.get("CORS_ALLOWED_ORIGINS")}

# Application Configuration
FILEVAULT_ROOT={config.get("FILEVAULT_ROOT")}
FERNET_SECRET_KEY={config.get("FERNET_SECRET_KEY")}
"""
    if not is_production:
        file_content += f"UV_CACHE_DIR={config.get('UV_CACHE_DIR')}\n"

    with open(env_file_path, "w") as f:
        f.write(file_content)

    print(
        f"\nSuccessfully created {os.path.basename(env_file_path)} in the project root."
    )
    if is_production:
        print("\nIMPORTANT: The generated .env file contains sensitive information.")
        print(
            "Ensure it is NOT committed to version control. Add '.env' to your .gitignore file."
        )


if __name__ == "__main__":
    main()

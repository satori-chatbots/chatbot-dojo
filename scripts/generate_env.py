import getpass
import os
import secrets
import string
from typing import Dict

from cryptography.fernet import Fernet
from django.core.management.utils import get_random_secret_key


def generate_django_secret_key() -> str:
    """
    Generates a cryptographically strong secret key using Django's utility.
    """
    return get_random_secret_key()


def generate_fernet_key() -> str:
    """
    Generates a Fernet key for encryption using the cryptography library.
    """
    return Fernet.generate_key().decode()


def generate_secure_password(length: int = 16) -> str:
    """
    Generates a cryptographically strong password.
    """
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def get_superuser_config() -> Dict[str, str]:
    """
    Prompts the user for superuser configuration.
    """
    print("\nSuperuser Configuration:")
    first_name = input("First name: ").strip()
    last_name = input("Last name: ").strip()
    email = input("Email: ").strip()

    while True:
        password = getpass.getpass(
            "Password (leave empty for auto-generated): "
        ).strip()
        if password:
            confirm_password = getpass.getpass("Confirm password: ").strip()
            if password == confirm_password:
                break
            else:
                print("Passwords don't match. Please try again.")
        else:
            password = generate_secure_password(20)
            print(f"Auto-generated password: {password}")
            break

    return {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password": password,
    }


def main() -> None:
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

    # Get superuser configuration
    superuser_config = get_superuser_config()

    config: Dict[str, str] = {}
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
            # Superuser Configuration
            "DJANGO_SUPERUSER_FIRST_NAME": superuser_config["first_name"],
            "DJANGO_SUPERUSER_LAST_NAME": superuser_config["last_name"],
            "DJANGO_SUPERUSER_EMAIL": superuser_config["email"],
            "DJANGO_SUPERUSER_PASSWORD": superuser_config["password"],
        }
    else:
        env_file_path = os.path.join(project_root, ".env.dev")
        dev_db_password = generate_secure_password()
        config = {
            # .env.dev
            "DEBUG": "True",
            "SECRET_KEY": generate_django_secret_key(),
            # Database Configuration
            "POSTGRES_DB": "senseiweb_dev",
            "POSTGRES_USER": "senseiweb_dev_user",
            "POSTGRES_PASSWORD": dev_db_password,
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
            # Superuser Configuration
            "DJANGO_SUPERUSER_FIRST_NAME": superuser_config["first_name"],
            "DJANGO_SUPERUSER_LAST_NAME": superuser_config["last_name"],
            "DJANGO_SUPERUSER_EMAIL": superuser_config["email"],
            "DJANGO_SUPERUSER_PASSWORD": superuser_config["password"],
        }

    file_content = f"""# Django Configuration
DEBUG=\"{config["DEBUG"]}\"
SECRET_KEY=\"{config["SECRET_KEY"]}\"

# Database Configuration
POSTGRES_DB=\"{config["POSTGRES_DB"]}\"
POSTGRES_USER=\"{config["POSTGRES_USER"]}\"
POSTGRES_PASSWORD=\"{config["POSTGRES_PASSWORD"]}\"
POSTGRES_HOST=\"{config["POSTGRES_HOST"]}\"
POSTGRES_PORT=\"{config["POSTGRES_PORT"]}\"

# RabbitMQ Configuration
RABBITMQ_HOST=\"{config["RABBITMQ_HOST"]}\"
RABBITMQ_PORT=\"{config["RABBITMQ_PORT"]}\"
RABBITMQ_USER=\"{config["RABBITMQ_USER"]}\"
RABBITMQ_PASSWORD=\"{config["RABBITMQ_PASSWORD"]}\"
RABBITMQ_VHOST=\"{config["RABBITMQ_VHOST"]}\"

# Celery Configuration (will be built from RabbitMQ settings above)
CELERY_RESULT_BACKEND=\"{config["CELERY_RESULT_BACKEND"]}\"

# Django Configuration
ALLOWED_HOSTS=\"{config["ALLOWED_HOSTS"]}\"
CORS_ALLOWED_ORIGINS=\"{config["CORS_ALLOWED_ORIGINS"]}\"

# Application Configuration
FILEVAULT_ROOT=\"{config["FILEVAULT_ROOT"]}\"
FERNET_SECRET_KEY=\"{config["FERNET_SECRET_KEY"]}\"

# Superuser Configuration
DJANGO_SUPERUSER_FIRST_NAME=\"{config["DJANGO_SUPERUSER_FIRST_NAME"]}\"
DJANGO_SUPERUSER_LAST_NAME=\"{config["DJANGO_SUPERUSER_LAST_NAME"]}\"
DJANGO_SUPERUSER_EMAIL=\"{config["DJANGO_SUPERUSER_EMAIL"]}\"
DJANGO_SUPERUSER_PASSWORD=\"{config["DJANGO_SUPERUSER_PASSWORD"]}\"
"""
    if not is_production:
        file_content += f'UV_CACHE_DIR="{config["UV_CACHE_DIR"]}"\n'
        print(
            f"\nDevelopment database password (POSTGRES_PASSWORD): {config['POSTGRES_PASSWORD']}"
        )

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

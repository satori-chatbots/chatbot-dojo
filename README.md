# sensei-web

A web server for sensei

## Installation

### Initialize git submodules

First, initialize the required git submodules:

```bash
git submodule init
git submodule update
```

### Backend setup

To make the server run, you need to have the project dependencies installed, but also the `user-simulator` ones.

**With `pip`:**
```bash
pip install -r requirements.txt
pip install -r ../user-simulator/requirements.txt
```

**With `uv`:**

If you don't have `uv` installed, you can find instructions at [https://docs.astral.sh/uv/getting-started/installation/](https://docs.astral.sh/uv/getting-started/installation/).

```bash
uv sync
```

#### Set up environment variables (.env)

You must have a `.env` file in the `backend` directory with the following variables:

- `FERNET_SECRET_KEY` — Used for encryption (auto-generated)
- `SECRET_KEY` — Django secret key (auto-generated)
- `DEBUG` — Set to `True` or `False` (default: True)

To generate or update your `.env` file with all required variables, you can use `make`:
```bash
make env
```

This will run the script at `scripts/generate_env.py`. You can also run the script directly:
```bash
python scripts/generate_env.py
```

#### Manual .env generation (if script cannot be used)

If you cannot run the script, you can manually generate the required keys and create the `.env` file:

1. **Generate Fernet key:**

   Open a Python shell and run:
   ```python
   from cryptography.fernet import Fernet
   print(Fernet.generate_key().decode())
   ```
   Copy the output.

2. **Generate Django SECRET_KEY:**

   If Django is installed, run:
   ```python
   from django.core.management.utils import get_random_secret_key
   print(get_random_secret_key())
   ```
   Copy the output.

3. **Create the `.env` file in the `backend` directory** with the following content:
   ```env
   FERNET_SECRET_KEY=<your-generated-fernet-key>
   SECRET_KEY=<your-generated-django-secret-key>
   DEBUG=True
   ```
   Replace the values with the ones you generated above.

#### Database setup and running the server

After setting up the environment variables, you can make the necessary migrations and then execute the server.

**Using Make:**
```bash
make migrations
make run
```

**Without Make:**
```bash
# Create and apply migrations
python manage.py makemigrations tester
python manage.py makemigrations
python manage.py migrate
# Run the server
python manage.py runserver
```

#### Database reset

In case of problems, you can reset the database.

**Using Make:**
```bash
make full-reset
```

**Without Make (Windows):**
```bash
# Delete migrations and database
del /s /q */migrations/0*.py
del db.sqlite3
# Recreate database
python manage.py makemigrations
python manage.py migrate
```

**Without Make (Linux/macOS):**
```bash
# Delete migrations and database
rm -rf */migrations/0*.py
rm db.sqlite3
# Recreate database
python manage.py makemigrations
python manage.py migrate
```

### Frontend setup

To set up and run the frontend, you need to have Node.js and pnpm installed. Then, follow these steps:

1. Navigate to the `frontend` folder:

   ```bash
   cd frontend
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Run the development server:

   ```bash
   pnpm run dev
   ```

The frontend will be running at `http://localhost:5173/`.

## Running with Celery and RabbitMQ

To run the application with background tasks using Celery and RabbitMQ, follow these steps:

1.  **Install and run RabbitMQ:**

    -   **Using Docker (recommended):**
        ```bash
        docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
        ```
        The management interface will be available at `http://localhost:15672` (user: `guest`, pass: `guest`).

    -   **Natively (Debian/Ubuntu):**
        ```bash
        sudo apt-get update
        sudo apt-get install rabbitmq-server
        sudo systemctl enable rabbitmq-server
        sudo systemctl start rabbitmq-server
        ```

    -   **Natively (Arch Linux):**
        ```bash
        sudo pacman -S rabbitmq
        sudo systemctl enable rabbitmq.service
        sudo systemctl start rabbitmq.service
        ```

2.  **Start the Celery worker:**

    In a new terminal, navigate to the `backend` directory and run:
    ```bash
    source .venv/bin/activate
    celery -A senseiweb worker -l info
    ```

3.  **Start the Django development server:**

    In another terminal, navigate to the `backend` directory and run:
    ```bash
    source .venv/bin/activate
    python manage.py runserver
    ```

## Docker-Based Workflow (Recommended)

This project is configured to run entirely within Docker, which is the recommended way to handle both development and production. This approach simplifies dependency management and ensures consistency across environments.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Environment Setup

The application uses `.env` files to manage environment variables. You must create two files in the project root:

1.  `.env.dev`: For the development environment.
2.  `.env.prod`: For the production environment.

These files are ignored by Git, so your secrets are safe. You can use the provided examples below as a starting point, but for production, be sure to generate a new `SECRET_KEY` and adjust `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to match your deployment domain.

#### `.env.dev` Example

```env
DEBUG=True
SECRET_KEY=django-insecure-dev-key-for-sensei-web
CELERY_BROKER_URL=amqp://guest:guest@rabbitmq:5672//
CELERY_RESULT_BACKEND=rpc://
DATABASE_URL=postgres://postgres:postgres@db:5432/senseiweb_dev
POSTGRES_DB=senseiweb_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
ALLOWED_HOSTS=localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### `.env.prod` Example

```env
DEBUG=False
SECRET_KEY=super-secret-prod-key-for-sensei-web
CELERY_BROKER_URL=amqp://guest:guest@rabbitmq:5672//
CELERY_RESULT_BACKEND=rpc://
DATABASE_URL=postgres://postgres:postgres@db:5432/senseiweb_prod
POSTGRES_DB=senseiweb_prod
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
ALLOWED_HOSTS=localhost,backend
CORS_ALLOWED_ORIGINS=http://localhost
```

### Development Workflow

This workflow is designed for active development, featuring hot-reloading for both the frontend and backend.

1.  **Start the services**:

    ```bash
    docker-compose -f docker-compose.dev.yml up --build
    ```

2.  **Access the application**:
    -   Frontend (with hot-reloading): `http://localhost:5173`
    -   Backend API: `http://localhost:8000`
    -   RabbitMQ Management: `http://localhost:15672`

3.  **Making Database Migrations**:

    If you change a Django model, you need to create and apply a database migration. Run these commands in a separate terminal:

    ```bash
    # Create a new migration file based on your model changes
    docker-compose -f docker-compose.dev.yml run --rm backend uv run python manage.py makemigrations

    # Apply the migration to the database
    docker-compose -f docker-compose.dev.yml run --rm backend uv run python manage.py migrate
    ```

4.  **Stopping the environment**:

    ```bash
    docker-compose -f docker-compose.dev.yml down
    ```

### Production Workflow

This workflow builds optimized, self-contained images ready for deployment.

1.  **Start the services**:

    To run in the foreground, use:
    ```bash
    docker-compose up --build
    ```

    For detached mode (recommended for servers), use:
    ```bash
    docker-compose up --build -d
    ```

2.  **Access the application**:

    The entire application is served by Nginx on a single port:
    -   Application URL: `http://localhost`
    -   RabbitMQ Management: `http://localhost:15672`

    Migrations are applied automatically on startup.

3.  **Stopping the environment**:

    ```bash
    docker-compose down
    ```

### Switching Environments

You cannot run the development and production environments simultaneously due to port conflicts. Always stop one before starting the other using the respective `down` command.

### Database Reset

If you need to completely reset your database (e.g., due to a corrupted volume), you can bring down the services and remove the associated volume. **This will permanently delete all data.**

-   **For Development**:
    ```bash
    docker-compose -f docker-compose.dev.yml down -v
    ```
-   **For Production**:
    ```bash
    docker-compose down -v
    ```


## Usage

You can now access the webpage at [http://localhost:5173/](http://localhost:5173/).

## Troubleshooting

### Common issues

**Port already in use:**

- Backend: Change port with `python manage.py runserver 8001`
- Frontend: Change port with `pnpm run dev -- --port 5174`

**Database migration errors:**

- Follow manual database reset steps above

**Missing dependencies:**

- Make sure both project and user-simulator requirements are installed
- Try recreating your virtual environment

**Environment variables not loading:**

- Check that `.env` file exists in `backend` directory
- Verify the file has the correct `FERNET_SECRET_KEY` format

## Development Setup

### Pre-commit Hooks

This project uses pre-commit hooks to ensure code quality and consistency.

#### Installation

1. Install pre-commit:
   ```bash
   pip install pre-commit
   ```

2. Install the git hooks:
   ```bash
   pre-commit install
   ```

3. Ensure frontend dependencies are installed:
   ```bash
   cd frontend && pnpm install
   ```

   **Note**: The project now uses pnpm instead of npm. Make sure you have pnpm installed globally:
   ```bash
   npm install -g pnpm
   ```

#### Usage

Pre-commit hooks will run automatically on `git commit`. You can also run them manually:

```bash
# Run on all files
pre-commit run --all-files

# Run on staged files only
pre-commit run
```

To skip pre-commit hooks temporarily (not recommended):
```bash
git commit --no-verify
```

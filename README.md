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

## Docker Deployment

For easier setup and deployment, you can use Docker Compose to run the entire application stack including Django, Celery, RabbitMQ, and PostgreSQL.

### Full Production-like Setup

Run the complete stack with PostgreSQL database:

```bash
docker-compose up --build
```

This will start:
- **Backend Django app** at `http://localhost:8000`
- **Celery worker** for async task processing
- **RabbitMQ** message broker (management UI at `http://localhost:15672` - guest/guest)
- **PostgreSQL** database

### Development Setup (SQLite)

For development with SQLite (no PostgreSQL):

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This starts the same services except uses SQLite database (data persisted in local files).

### Frontend

The Docker setup only includes the backend services. Run the frontend separately:

```bash
cd frontend
pnpm install
pnpm run dev
```

The frontend will be available at `http://localhost:5173/`.

### Environment Variables

The Docker setup uses these environment variables:
- `CELERY_BROKER_URL` - Message broker URL (set to RabbitMQ container)
- `CELERY_RESULT_BACKEND` - Result backend URL
- `DATABASE_URL` - PostgreSQL connection (full setup only)
- `DEBUG` - Django debug mode

### Troubleshooting

**If you see "ModuleNotFoundError" or "exec: no such file or directory":**
- Stop the containers: `docker-compose down`
- Rebuild: `docker-compose up --build`
- This ensures the latest Dockerfile changes are applied

**To view logs:**
```bash
docker-compose logs backend
docker-compose logs celery
docker-compose logs rabbitmq
```

**To restart just one service:**
```bash
docker-compose restart backend
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

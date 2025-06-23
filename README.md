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

To make the server run, you need to have the project dependencies installed, but also the `user-simulator` ones. To do so, in a preferably new virtual environment, run the following commands:

```bash
pip install -r requirements.txt
pip install -r ../user-simulator/requirements.txt
```

Or if you use `uv`:

```bash
uv sync
```

#### Set up environment variables (.env)

You must have a `.env` file in the `backend` directory with the following variables:

- `FERNET_SECRET_KEY` — Used for encryption (auto-generated)
- `SECRET_KEY` — Django secret key (auto-generated)
- `DEBUG` — Set to `True` or `False` (default: True)

To generate or update your `.env` file with all required variables, run:

```bash
make env
```

This will run the script at `scripts/generate_env.py`, which will create or update `.env` with all necessary keys. You can also run the script directly:

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
   Copy the output (it will look like `EZsbc2bocfVw-1I8T-qq9gzrqiNv7_YtT0FOybwak2U=`).

2. **Generate Django SECRET_KEY:**

   If Django is installed, run:
   ```python
   from django.core.management.utils import get_random_secret_key
   print(get_random_secret_key())
   ```
   Copy the output (a long random string).

3. **Create the `.env` file in the `backend` directory** with the following content:
   ```env
   FERNET_SECRET_KEY=<your-generated-fernet-key>
   SECRET_KEY=<your-generated-django-secret-key>
   DEBUG=True
   ```
   Replace the values with the ones you generated above.

#### Database setup and running the server

After setting up the Fernet key, you can make the necessary migrations and then execute the server:

Using Make:

```bash
make migrations
make run
```

Without Make:

```bash
# Create and apply migrations
python manage.py makemigrations tester
python manage.py makemigrations
python manage.py migrate
# Run the server
python manage.py runserver
```

#### Database reset

In case of problems, you can reset the database:

Using Make:

```bash
make full-reset
```

Without Make:

```bash
# Delete migrations and database
del /s /q */migrations/0*.py
del db.sqlite3
# Recreate database
python manage.py makemigrations
python manage.py migrate
```

Without Make:

```bash
# Delete migrations and database
rm -rf */migrations/0*.py
rm db.sqlite3
# Recreate database
python manage.py makemigrations
python manage.py migrate
```

### Frontend setup

To set up and run the frontend, you need to have Node.js and npm installed. Then, follow these steps:

1. Navigate to the `frontend` folder:

   ```bash
   cd frontend
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

The frontend will be running at `http://localhost:5173/`.

## Usage

You can now access the webpage at [http://localhost:5173/](http://localhost:5173/).

## Troubleshooting

### Common issues

**Port already in use:**

- Backend: Change port with `python manage.py runserver 8001`
- Frontend: Change port with `npm run dev -- --port 5174`

**Database migration errors:**

- Run `make full-reset` or follow manual database reset steps above

**Missing dependencies:**

- Make sure both project and user-simulator requirements are installed
- Try recreating your virtual environment

**Environment variables not loading:**

- Check that `.env` file exists in `backend` directory
- Verify the file has the correct `FERNET_SECRET_KEY` format

## Development Setup

### Pre-commit Hooks

This project uses pre-commit hooks to ensure code quality and consistency. The hooks include:

- **Ruff** for Python linting and formatting (backend only)
- **ESLint** for JavaScript/TypeScript linting (frontend)
- **General hooks** for trailing whitespace, end-of-file fixes, and merge conflict detection

#### Installation

1. Install pre-commit using UV:
   ```bash
   uv add --group dev pre-commit
   ```

2. Install the git hooks:
   ```bash
   uv run pre-commit install
   ```

3. Ensure frontend dependencies are installed:
   ```bash
   cd frontend && npm install
   ```

#### Usage

Pre-commit hooks will run automatically on `git commit`. You can also run them manually:

```bash
# Run on all files
uv run pre-commit run --all-files

# Run on staged files only
uv run pre-commit run
```

To skip pre-commit hooks temporarily (not recommended):
```bash
git commit --no-verify
```

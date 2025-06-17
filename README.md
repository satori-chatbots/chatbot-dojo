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

#### Set up the Fernet secret key

Run the provided script to generate your encryption key:

```bash
python scripts/generate_fernet_key.py
```

This will automatically create a `.env` file in the `backend` directory with your secret key.

Alternatively, you can generate it manually:

1. Open a Python interpreter (run `python` or `python3`)
2. Import fernet:

   ```python
   from cryptography.fernet import Fernet
   ```

3. Generate the key:

   ```python
   key = Fernet.generate_key().decode()
   ```

4. Print the key:

   ```python
   print(f"FERNET_SECRET_KEY={key}")
   ```

This will generate something like `FERNET_SECRET_KEY=EZsbc2bocfVw-1I8T-qq9gzrqiNv7_YtT0FOybwak2U=`

Copy this and place it inside: `sensei-web/backend/.env` (create the `.env` file if it doesn't exist)

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

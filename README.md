# sensei-web

A web server for sensei

## Installation

To update this repo, since it depends on the `user-simulator` we have to make a git pull like this:

```bash
git pull --recurse-submodules
```

or if you have Make installed:

```bash
make pull-submodules
```

If you want to do it automatically you can add this to your config:

```bash
git config submodule.recurse true
```

### Backend setup

To make the server run, you need to have the project dependencies installed, but also the `user-simulator` ones. To do so, in a preferably new virtual environment, run the following commands:

```bash
pip install -r requirements.txt
pip install -r ../user-simulator/requirements.txt
```

Set up the Fernet secret key so things in the database get secured:

1. Open a Python interpret (run `python` or `python3`)
2. Import fernet
```
from cryptography.fernet import Fernet
```
3. Generate the key
```
key = Fernet.generate_key().decode()
```
4. Print the key
```
print(f"FERNET_SECRET_KEY={key}")
```
This will generate something like `FERNET_SECRET_KEY=EZsbc2bocfVw-1I8T-qq9gzrqiNv7_YtT0FOybwak2U=`

Copy this and place it inside: `/sensei-web/backend/.env`, you must create the `.env` if it does not exist


After that, you can make the necessary migrations and then execute the server:

Using Make (Unix/Linux):

```bash
make migrations
make run
```

Without Make (Windows/Unix):

```bash
# Create and apply migrations
python manage.py makemigrations
python manage.py migrate

# Run the server
python manage.py runserver
```

In case of problems, you can reset the database:

Using Make (Unix/Linux):

```bash
make full-reset
```

Without Make (Windows):

```bash
# Delete migrations and database
del /s /q */migrations/0*.py
del db.sqlite3

# Recreate database
python manage.py makemigrations
python manage.py migrate
```

Without Make (Unix/Linux):

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

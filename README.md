# Sensei and Tracer Web

## Requirements

- Docker
- Docker Compose

## Git Submodule

To initialize user simulator (sensei)

```bash
git submodule init
git submodule update
```

## Generate `.env` and `.env.dev`

Use the script `generate_env.py`
(if you don't have the dependencies to run it see Python Setup)

```bash
python scripts/generate_env.py
```

## Docker Setup

The basic commands are the base command of each section plus:

- `build`: builds the image
- `build --no-cache`: builds the image without cache
- `up`: spins up the container
- `up -d`: spins up the container in detached mode
- `logs <container name>`: see the logs of certain container
- `down`: spins down the container
- `down -v`: spins down and **deletes the volumes**

### Development

Base command:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev
```

You may have to `source .env.dev`
to override any variable that you may have in your environment.

### Production

```bash
docker compose
```


### Other commands

Get a shell in the backend (can be changed for another container or for production).

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev exec -it  backend /bin/bash
```

Get a Django shell:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev exec -it backend python manage.py shell
```

## Migrations

The migrations are committed to the repo as the Django docs suggest.

The container will run automatically the migrate,
but if you modify a model, make sure to run the `makemigrations` yourself
and test them in a development container before taking it to production.

```bash
python manage.py makemigrations
```


If that doesn't work run the migrations within the container:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev exec backend python manage.py makemigrations
```

And then:
```bash

docker compose -f docker-compose.dev.yml --env-file .env.dev exec backend python manage.py migrate 
```

If it is in production it is the same just changing the base command to:

```bash
docker compose exec backend python manage.py
```

## Local Dependencies (Optional but suggested)

In case you prefer running this instead of Docker (for local development).
And I think that they are needed for the `precommit`.

### Python Setup

It is recommended to use [UV](https://docs.astral.sh/uv/getting-started/installation/)

With `UV`:

```bash
cd backend
uv sync
source .venv/bin/activate
```

With `pip`:

```bash
cd backend
pip install -r requirements.txt
```

Then run it with

```bash
python manage.py runserver
```

### PNPM Setup

Make sure you have installed [PNPM](https://pnpm.io/installation), then:

```bash
cd frontend
pnpm install
```

Then run it with:

```bash
pnpm run dev
```

### RabbitMQ Setup

- **Using Docker:**

    ```bash
    docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management
    ```

    The management interface will be available at `http://localhost:15672`
    (user: `guest`, pass: `guest`).

- **Natively (Debian/Ubuntu):**

    ```bash
    sudo apt-get update
    sudo apt-get install rabbitmq-server
    sudo systemctl enable rabbitmq-server
    sudo systemctl start rabbitmq-server
    ```

- **Natively (Arch Linux):**

    ```bash
    sudo pacman -S rabbitmq
    sudo systemctl enable rabbitmq.service
    sudo systemctl start rabbitmq.service
    ```

### Celery Setup

In a new terminal, navigate to the `backend` directory and run:

```bash
source .venv/bin/activate
celery -A senseiweb worker -l info
```

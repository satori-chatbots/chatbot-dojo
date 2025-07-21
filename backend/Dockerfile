# ─────────────── Builder stage ───────────────
FROM python:3.12-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# Copy dependency config and lock
COPY pyproject.toml uv.lock ./

# Install dependencies but skip project install (cache layer)
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked --no-install-project

# Copy full project
COPY . .

# Now install project + any extra dependencies into the venv
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked

# ─────────────── Runtime stage ───────────────
FROM python:3.12-slim-bookworm AS runtime
RUN apt-get update \
  && apt-get install -y libpcre3 libxml2 graphviz \
  && rm -rf /var/lib/apt/lists/*

# Copy complete .venv with Django, uv, and all libs
COPY --from=builder /app/.venv /app/.venv
# Copy application source code
COPY --from=builder /app /app
# Also bring uv binary into final image
COPY --from=builder /bin/uv /bin/uv

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH"

# Final entrypoint to run Django dev server
CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8000"]

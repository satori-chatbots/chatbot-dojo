# ─────────────── Builder stage ───────────────
FROM python:3.12-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

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

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpcre3 \
    libxml2 \
    graphviz \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for the application
RUN groupadd -r django && useradd -r -g django -u 1000 django

# Copy complete .venv with Django, uv, and all libs
COPY --from=builder /app/.venv /app/.venv

# Copy application source code
COPY --from=builder /app /app

# Also bring uv binary into final image
COPY --from=builder /bin/uv /bin/uv

# Create necessary directories and set proper permissions
RUN mkdir -p /app/filevault /app/.uv-cache && \
    chown -R django:django /app && \
    chmod -R 755 /app/filevault /app/.uv-cache

WORKDIR /app

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV UV_CACHE_DIR="/app/.uv-cache"

# Copy and set up entrypoint script
COPY ./entrypoint.prod.sh /app/entrypoint.prod.sh
RUN chmod +x /app/entrypoint.prod.sh && \
    chown django:django /app/entrypoint.prod.sh

# Switch to non-root user
USER django

# Final entrypoint to run Django prod server
CMD ["/app/entrypoint.prod.sh"]

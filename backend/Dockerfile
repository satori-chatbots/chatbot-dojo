# ─────────────── Builder stage ───────────────
FROM python:3.12-slim-bookworm AS builder

ARG PRELOAD_SENPAI_EMBEDDING_MODEL=1
ENV SENPAI_EMBEDDING_MODEL_CACHE_ROOT="/opt/senpai-embedding-model-cache"

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN mkdir -p /opt/senpai-embedding-model-cache

# Copy dependency config and lock
COPY pyproject.toml uv.lock ./

# Install dependencies but skip project install (cache layer)
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked --no-install-project

# Optionally pre-download Senpai's embedding model before app source is copied.
# This keeps the model cache in a stable Docker layer that is not invalidated by
# normal backend code changes.
RUN if [ "$PRELOAD_SENPAI_EMBEDDING_MODEL" = "1" ]; then \
      HF_HOME="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}/huggingface" \
      HF_HUB_CACHE="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}/huggingface/hub" \
      HUGGINGFACE_HUB_CACHE="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}/huggingface/hub" \
      TRANSFORMERS_CACHE="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}/huggingface/transformers" \
      SENTENCE_TRANSFORMERS_HOME="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}/huggingface/sentence-transformers" \
      TORCH_HOME="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}/torch" \
      HOME="${SENPAI_EMBEDDING_MODEL_CACHE_ROOT}" \
      ./.venv/bin/python -c "from langchain_huggingface import HuggingFaceEmbeddings; from senpai_assistant.embeddings.get_embedding import MODEL_NAME; print(f'Preloading Senpai embedding model: {MODEL_NAME}'); HuggingFaceEmbeddings(model_name=MODEL_NAME).embed_query('warmup')"; \
    fi

# Copy backend source
COPY . ./

# Now install project + any extra dependencies into the venv
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked

# ─────────────── Runtime stage ───────────────
FROM python:3.12-slim-bookworm AS runtime

ENV SENPAI_EMBEDDING_MODEL_CACHE_ROOT="/opt/senpai-embedding-model-cache"

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

# Copy application source code (excluding .venv to avoid conflicts)
COPY --from=builder --chown=django:django /app /app
COPY --from=builder --chown=django:django /opt/senpai-embedding-model-cache /opt/senpai-embedding-model-cache

# Also bring uv binary into final image
COPY --from=builder /bin/uv /bin/uv

# Create runtime directories
RUN mkdir -p /app/filevault /app/.uv-cache /app/static && \
    chown -R django:django /app/filevault /app/.uv-cache /app/static && \
    chmod 755 /app/filevault /app/.uv-cache /app/static

WORKDIR /app

# Set environment variables
ENV PATH="/app/.venv/bin:$PATH"
ENV UV_CACHE_DIR="/app/.uv-cache"

# Copy and set up entrypoint script
COPY --chown=django:django entrypoint.prod.sh /app/entrypoint.prod.sh
COPY --chown=django:django entrypoint.celery.sh /app/entrypoint.celery.sh
RUN chmod +x /app/entrypoint.prod.sh /app/entrypoint.celery.sh

# Switch to non-root user
USER django

# Final entrypoint to run Django prod server
CMD ["/app/entrypoint.prod.sh"]

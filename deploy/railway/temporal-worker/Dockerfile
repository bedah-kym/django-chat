FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    SKIP_MIGRATIONS=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    ffmpeg \
    tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

RUN addgroup --system django && adduser --system --group django

COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . /app/

RUN chmod +x /app/entrypoint.sh /app/scripts/railway/temporal_worker.sh \
    && chown -R django:django /app

USER django

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["sh", "-c", "cd /app/Backend && exec python manage.py start_temporal_worker"]

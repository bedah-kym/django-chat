#!/bin/sh
set -e

cd /app/Backend

POOL=${CELERY_POOL:-prefork}
MAX_TASKS=${CELERY_WORKER_MAX_TASKS_PER_CHILD:-200}
MAX_MEM=${CELERY_WORKER_MAX_MEMORY_PER_CHILD:-250000}

if [ -n "$CELERY_AUTOSCALE" ]; then
  SCALE_ARGS="--autoscale ${CELERY_AUTOSCALE}"
else
  SCALE_ARGS="--concurrency ${CELERY_CONCURRENCY:-1}"
fi

# Optional embedded beat: run the scheduler inside this worker so a separate
# "Celery beat" service isn't needed. SAFE ONLY with a SINGLE worker replica —
# with >1 replica each would run beat and fire duplicate scheduled tasks.
# Enable by setting CELERY_EMBED_BEAT=true on this service (and keep replicas=1).
BEAT_ARGS=""
if [ "${CELERY_EMBED_BEAT:-false}" = "true" ]; then
  BEAT_ARGS="--beat --scheduler django_celery_beat.schedulers:DatabaseScheduler"
fi

exec celery -A Backend worker -l info --pool ${POOL} ${SCALE_ARGS} ${BEAT_ARGS} \
  --max-tasks-per-child ${MAX_TASKS} \
  --max-memory-per-child ${MAX_MEM}

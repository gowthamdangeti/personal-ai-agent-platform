from arq.connections import RedisSettings
from app.core.config import settings
from app.workers.tasks import ingest_document


class WorkerSettings:
    functions = [ingest_document]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 5
    job_timeout = 600
    keep_result = 3600

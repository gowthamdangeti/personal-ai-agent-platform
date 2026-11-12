from arq.connections import RedisSettings
from app.core.config import settings
from app.workers.tasks import ingest_document
from app.workers.arq_worker import run_agent_job


class WorkerSettings:
    functions = [ingest_document, run_agent_job]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    job_timeout = 900
    keep_result = 3600

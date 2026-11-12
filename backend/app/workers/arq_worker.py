import logging
import uuid
from arq.connections import RedisSettings
from sqlalchemy import select
from app.agents.engine import agent_engine
from app.agents.registry import agent_registry
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.agent import Agent, AgentRun
from app.workers.tasks import ingest_document

logger = logging.getLogger(__name__)


async def run_agent_job(ctx: dict, slug: str, payload: dict, run_id: str):
    """
    ARQ Background Task executing any agent asynchronously.
    Supports default, fast_io, and heavy_compute queues.
    """
    logger.info("Executing async agent job: slug=%s, run_id=%s", slug, run_id)
    run_uuid = uuid.UUID(run_id)

    async with AsyncSessionLocal() as db:
        run = await db.get(AgentRun, run_uuid)
        if not run:
            logger.error("AgentRun %s not found in database.", run_id)
            return

        run.status = "running"
        await db.commit()

        # Find or create agent
        agent = await db.scalar(select(Agent).where(Agent.slug == slug))
        if not agent and slug in agent_registry.supported_kinds():
            agent = Agent(
                name=slug.replace("_", " ").title(),
                slug=slug,
                kind=slug,
                description=f"Auto-registered {slug} agent",
                config={},
            )
            db.add(agent)
            await db.commit()
            await db.refresh(agent)

        if not agent:
            run.status = "failed"
            run.error_message = f"Agent '{slug}' could not be resolved."
            await db.commit()
            return

        payload["run_id"] = run_uuid
        payload["agent_id"] = agent.id

        try:
            executed_run = await agent_engine.execute(db, agent, payload)
            logger.info("Async agent job completed: run_id=%s, status=%s", run_id, executed_run.status)
        except Exception as exc:
            logger.exception("Async agent job failed: %s", exc)
            run.status = "failed"
            run.error_message = str(exc)[:2000]
            await db.commit()


class WorkerSettings:
    """Configures distributed ARQ worker processes."""
    functions = [run_agent_job, ingest_document]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_jobs = 10
    job_timeout = 900
    keep_result = 3600
    queue_name = "default"


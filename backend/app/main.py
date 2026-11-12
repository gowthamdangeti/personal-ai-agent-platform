from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy import select
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.agent import Agent
import app.models  # Ensure all models are registered

logger = logging.getLogger(__name__)

INITIAL_AGENTS = [
    {
        "name": "Knowledge Assistant",
        "slug": "knowledge-assistant",
        "kind": "knowledge",
        "description": "Answers questions using your indexed documents with RRF and citations.",
        "config": {"top_k": settings.default_retrieval_k},
    },
    {
        "name": "Document Processing Assistant",
        "slug": "document-processing-assistant",
        "kind": "document_processing",
        "description": "Extracts requested fields and structured information from an indexed document.",
        "config": {"output": "json"},
    },
    {
        "name": "Research Assistant",
        "slug": "research-assistant",
        "kind": "research",
        "description": "Recursive web synthesis and deep multi-source intelligence reports.",
        "config": {"depth": 2},
    },
    {
        "name": "Meeting Intelligence Assistant",
        "slug": "meeting-intelligence-assistant",
        "kind": "meeting_intelligence",
        "description": "Transcript summarization, decision extraction, and Jira action item sync.",
        "config": {},
    },
    {
        "name": "QA Assistant",
        "slug": "qa-assistant",
        "kind": "qa",
        "description": "Automated test suite generator (PyTest/Playwright) and sandboxed execution.",
        "config": {"framework": "pytest"},
    },
    {
        "name": "Procurement Assistant",
        "slug": "procurement-assistant",
        "kind": "procurement",
        "description": "Vendor proposal scoring matrix and purchase order generation with HITL gate.",
        "config": {},
    },
    {
        "name": "Finance Assistant",
        "slug": "finance-assistant",
        "kind": "finance",
        "description": "3-way invoice-to-PO matching and Z-score ledger anomaly detection.",
        "config": {},
    },
    {
        "name": "IT Operations Assistant",
        "slug": "it-ops-assistant",
        "kind": "it_ops",
        "description": "Log anomaly RCA, Prometheus diagnostics, and gated pod remediation.",
        "config": {},
    },
    {
        "name": "Workflow Automation Assistant",
        "slug": "workflow-automation-assistant",
        "kind": "workflow_automation",
        "description": "Multi-agent DAG workflow orchestration with topological sorting.",
        "config": {},
    },
    {
        "name": "Data Analyst Assistant",
        "slug": "data-analyst-assistant",
        "kind": "data_analyst",
        "description": "Text-to-SQL with AST query security guards and Plotly chart generation.",
        "config": {"chart_type": "bar"},
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    try:
        app.state.arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    except Exception as e:
        logger.warning("Could not connect to Redis ARQ pool: %s", e)
        app.state.arq_pool = None

    # Seed all 10 default agents (Schema managed by Alembic migrations)
    try:
        async with AsyncSessionLocal() as db:
            for agent_spec in INITIAL_AGENTS:
                existing = await db.scalar(select(Agent).where(Agent.slug == agent_spec["slug"]))
                if existing is None:
                    db.add(Agent(
                        name=agent_spec["name"],
                        slug=agent_spec["slug"],
                        kind=agent_spec["kind"],
                        description=agent_spec["description"],
                        config=agent_spec["config"],
                    ))
            await db.commit()
    except Exception as e:
        logger.warning("Agent seeding warning: %s", e)

    logger.info("Application startup complete with 10 agents ready.")
    try:
        yield
    finally:
        if getattr(app.state, "arq_pool", None):
            await app.state.arq_pool.aclose()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": "0.1.0", "docs": "/docs", "health": "/health/ready"}

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
from app.db.session import AsyncSessionLocal
from app.models.agent import Agent

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    app.state.arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(Agent).where(Agent.slug == "knowledge-assistant"))
        if existing is None:
            db.add(Agent(
                name="Knowledge Assistant", slug="knowledge-assistant", kind="knowledge",
                description="Answers questions using your indexed documents.",
                config={"top_k": settings.default_retrieval_k},
            ))
        processor = await db.scalar(select(Agent).where(Agent.slug == "document-processing-assistant"))
        if processor is None:
            db.add(Agent(
                name="Document Processing Assistant", slug="document-processing-assistant",
                kind="document_processing",
                description="Extracts requested fields and structured information from an indexed document.",
                config={"output": "json"},
            ))
        await db.commit()
    logger.info("Application startup complete")
    try:
        yield
    finally:
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

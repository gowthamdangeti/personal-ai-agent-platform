from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.agent import Agent, AgentRun
from app.models.document import Document

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    agents = await db.scalar(select(func.count()).select_from(Agent)) or 0
    documents = await db.scalar(select(func.count()).select_from(Document)) or 0
    ready_documents = await db.scalar(select(func.count()).select_from(Document).where(Document.status == "ready")) or 0
    runs = await db.scalar(select(func.count()).select_from(AgentRun)) or 0
    return {"agents": agents, "documents": documents, "ready_documents": ready_documents, "runs": runs}

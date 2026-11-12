from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.knowledge.agent import KnowledgeAgent, hybrid_retrieve
from app.db.session import get_db

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class HybridSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)


@router.post("/retrieve-hybrid")
async def retrieve_hybrid_endpoint(
    payload: HybridSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Directly test hybrid dense + sparse RRF document retrieval."""
    res = await hybrid_retrieve(db, {"query": payload.query, "top_k": payload.top_k})
    return res


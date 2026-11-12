import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import ActionItem, MeetingSession
from app.schemas.agent_payloads import MeetingProcessRequest
from app.agents.meeting_intelligence.agent import MeetingIntelligenceAgent

router = APIRouter(prefix="/meeting-intelligence", tags=["meeting_intelligence"])


@router.post("/process-transcript")
async def process_transcript_endpoint(
    payload: MeetingProcessRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = MeetingIntelligenceAgent()
    return await agent.execute(db, {"title": payload.title, "transcript": payload.transcript})


@router.get("/sessions")
async def list_meetings(db: AsyncSession = Depends(get_db)):
    sessions = (
        await db.scalars(select(MeetingSession).order_by(MeetingSession.meeting_date.desc()).limit(20))
    ).all()
    return list(sessions)


@router.get("/sessions/{session_id}/action-items")
async def get_session_action_items(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    items = (
        await db.scalars(
            select(ActionItem).where(ActionItem.meeting_id == session_id).order_by(ActionItem.created_at.asc())
        )
    ).all()
    return list(items)


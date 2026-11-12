import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import ResearchProject
from app.schemas.agent_payloads import ResearchRequest
from app.agents.research.agent import ResearchAgent

router = APIRouter(prefix="/research", tags=["research"])


@router.post("/deep-dive")
async def launch_deep_dive(
    payload: ResearchRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = ResearchAgent()
    return await agent.execute(db, {"topic": payload.topic, "depth": payload.depth})


@router.get("/projects")
async def list_research_projects(db: AsyncSession = Depends(get_db)):
    projects = (
        await db.scalars(select(ResearchProject).order_by(ResearchProject.created_at.desc()).limit(20))
    ).all()
    return list(projects)


@router.get("/projects/{project_id}")
async def get_research_project(project_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    proj = await db.get(ResearchProject, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    return proj


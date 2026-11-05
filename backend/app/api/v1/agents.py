import re
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.engine import agent_engine
from app.agents.registry import agent_registry
from app.db.session import get_db
from app.models.agent import Agent, AgentRun
from app.schemas.agent import AgentCreate, AgentRead, AgentRunRead, AgentRunRequest

router = APIRouter(prefix="/agents", tags=["agents"])


def make_slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "agent"
    return base[:100]


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(Agent).order_by(Agent.created_at.desc()))).all())


@router.post("", response_model=AgentRead, status_code=201)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    if payload.kind not in agent_registry.supported_kinds():
        raise HTTPException(status_code=422, detail=f"Unsupported agent kind. Available: {agent_registry.supported_kinds()}")
    base = make_slug(payload.name)
    slug = base
    counter = 2
    while await db.scalar(select(Agent.id).where(Agent.slug == slug)):
        slug = f"{base}-{counter}"
        counter += 1
    agent = Agent(name=payload.name, slug=slug, kind=payload.kind, description=payload.description, config=payload.config)
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.post("/{agent_id}/runs", response_model=AgentRunRead, status_code=201)
async def run_agent(agent_id: UUID, payload: AgentRunRequest, request: Request, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.kind == "knowledge":
        if not payload.question:
            raise HTTPException(status_code=422, detail="Knowledge Agent requires a question")
        run_payload = {
            "question": payload.question,
            "top_k": payload.top_k,
            "provider": payload.provider,
            "model": payload.model,
            "credential_id": str(payload.credential_id) if payload.credential_id else None,
        }
    elif agent.kind == "document_processing":
        if not payload.document_id:
            raise HTTPException(status_code=422, detail="Document Processing Agent requires document_id")
        run_payload = {
            "document_id": str(payload.document_id),
            "instructions": payload.instructions,
            "fields": payload.fields,
            "provider": payload.provider,
            "model": payload.model,
            "credential_id": str(payload.credential_id) if payload.credential_id else None,
        }
    else:
        raise HTTPException(status_code=422, detail="Agent kind is not executable yet")
    try:
        run = await agent_engine.execute(db, agent, run_payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}") from exc
    return AgentRunRead.from_model(run)


@router.get("/runs", response_model=list[AgentRunRead])
async def list_runs(limit: int = 25, db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 100))
    runs = (await db.scalars(select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit))).all()
    return [AgentRunRead.from_model(run) for run in runs]

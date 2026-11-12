import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import WorkflowDefinition, WorkflowExecution
from app.agents.workflow.agent import WorkflowAutomationAgent

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("")
@router.get("/")
async def list_workflows(db: AsyncSession = Depends(get_db)):
    wfs = (await db.scalars(select(WorkflowDefinition).order_by(WorkflowDefinition.created_at.desc()).limit(20))).all()
    return list(wfs)


@router.post("")
@router.post("/")
async def create_and_trigger_workflow(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    agent = WorkflowAutomationAgent()
    return await agent.execute(db, payload)


@router.get("/executions")
async def list_workflow_executions(db: AsyncSession = Depends(get_db)):
    execs = (await db.scalars(select(WorkflowExecution).order_by(WorkflowExecution.started_at.desc()).limit(20))).all()
    return list(execs)


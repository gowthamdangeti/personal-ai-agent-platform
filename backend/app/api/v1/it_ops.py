from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import IncidentTicket
from app.schemas.agent_payloads import ITOpsDiagnoseRequest
from app.agents.it_ops.agent import ITOperationsAgent

router = APIRouter(prefix="/it-ops", tags=["it_ops"])


@router.post("/diagnose-incident")
async def diagnose_incident_endpoint(
    payload: ITOpsDiagnoseRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = ITOperationsAgent()
    return await agent.execute(
        db,
        {
            "service_name": payload.service_name,
            "error_logs": payload.error_logs,
            "severity": payload.severity,
        },
    )


@router.get("/incidents")
async def list_incident_tickets(db: AsyncSession = Depends(get_db)):
    tickets = (
        await db.scalars(select(IncidentTicket).order_by(IncidentTicket.created_at.desc()).limit(20))
    ).all()
    return list(tickets)


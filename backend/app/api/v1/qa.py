import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import TestSuite
from app.schemas.agent_payloads import QAGenerateRequest
from app.agents.qa.agent import QAAgent

router = APIRouter(prefix="/qa", tags=["qa"])


@router.post("/generate-tests")
async def generate_tests_endpoint(
    payload: QAGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = QAAgent()
    return await agent.execute(
        db,
        {
            "target_service": payload.target_service,
            "framework": payload.framework,
            "spec_or_diff": payload.spec_or_diff,
        },
    )


@router.get("/suites")
async def list_test_suites(db: AsyncSession = Depends(get_db)):
    suites = (await db.scalars(select(TestSuite).order_by(TestSuite.created_at.desc()).limit(20))).all()
    return list(suites)


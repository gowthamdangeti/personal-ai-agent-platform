from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.agent_payloads import TextToSQLRequest
from app.agents.data_analyst.agent import DataAnalystAgent, execute_sql_query

router = APIRouter(prefix="/data-analyst", tags=["data_analyst"])


@router.post("/text-to-sql")
async def text_to_sql_endpoint(
    payload: TextToSQLRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = DataAnalystAgent()
    return await agent.execute(
        db,
        {
            "prompt": payload.prompt,
            "chart_type": payload.chart_type,
        },
    )


@router.post("/execute-query")
async def direct_sql_query(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    res = await execute_sql_query(db, {"sql": payload.get("sql", "")})
    if "error" in res and "Security Violation" in res["error"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


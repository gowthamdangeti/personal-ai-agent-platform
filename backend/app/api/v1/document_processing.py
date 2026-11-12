import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import ExtractionRecord
from app.schemas.agent_payloads import StructuredExtractionRequest
from app.agents.document_processing.agent import DocumentProcessingAgent

router = APIRouter(prefix="/document-processing", tags=["document_processing"])


@router.post("/extract")
async def extract_document_endpoint(
    payload: StructuredExtractionRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = DocumentProcessingAgent()
    result = await agent.execute(
        db,
        {
            "document_id": str(payload.document_id),
            "schema_name": payload.schema_name,
            "fields": list(payload.target_json_schema.keys()) if payload.target_json_schema else [],
        },
    )
    return result


@router.get("/records/{document_id}")
async def get_extraction_records(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    records = (
        await db.scalars(
            select(ExtractionRecord)
            .where(ExtractionRecord.document_id == document_id)
            .order_by(ExtractionRecord.created_at.desc())
        )
    ).all()
    return list(records)


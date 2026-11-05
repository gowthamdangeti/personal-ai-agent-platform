import json
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.base import BaseAgent
from app.models.document import Document, DocumentChunk
from app.services.llm import llm_service
from app.services.llm_resolver import ResolvedLLMConfig, resolve_llm_config


class DocumentProcessingAgent(BaseAgent):
    kind = "document_processing"

    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        if llm_config is None:
            llm_config = await resolve_llm_config(db, payload=payload)

        document_id = UUID(str(payload["document_id"]))
        document = await db.get(Document, document_id)
        if document is None:
            raise ValueError("Document not found")
        if document.status != "ready":
            raise ValueError(f"Document is not ready for processing (status: {document.status})")

        chunks = (
            await db.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.document_id == document_id)
                .order_by(DocumentChunk.chunk_index)
            )
        ).all()
        full_text = "\n\n".join(chunk.content for chunk in chunks)
        if not full_text.strip():
            raise ValueError("No extracted text is available for this document")

        result = await llm_service.extract_document_fields(
            filename=document.filename,
            text=full_text,
            instructions=payload.get("instructions", ""),
            fields=payload.get("fields", []),
            llm_config=llm_config,
        )
        sources = [
            {
                "document_id": str(document.id),
                "filename": document.filename,
                "chunk_count": len(chunks),
            }
        ]
        return {"answer": json.dumps(result, ensure_ascii=False, indent=2), "sources": sources}

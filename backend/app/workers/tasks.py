import asyncio
import logging
from uuid import UUID
from sqlalchemy import delete, select
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.document import Document, DocumentChunk
from app.services.chunking import chunk_text
from app.services.document_extractor import extract_text
from app.services.embeddings import embedding_provider
from app.services.storage import storage

logger = logging.getLogger(__name__)


async def ingest_document(ctx, document_id: str):
    """ARQ task: extract, chunk and index one uploaded document."""
    async with AsyncSessionLocal() as db:
        document = await db.scalar(select(Document).where(Document.id == UUID(document_id)))
        if document is None:
            return {"status": "skipped", "reason": "document_not_found"}
        document.status = "processing"
        document.error_message = None
        await db.commit()
        try:
            raw = await asyncio.to_thread(storage.get_bytes, document.object_key)
            extracted = await asyncio.to_thread(extract_text, document.filename, raw)
            chunks = chunk_text(extracted)
            if not chunks:
                raise ValueError("No extractable text found. Scanned PDFs need OCR, which is not included in this starter.")
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
            rows = [
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=index,
                    content=chunk,
                    embedding=embedding_provider.embed(chunk),
                    metadata_json={"filename": document.filename},
                )
                for index, chunk in enumerate(chunks)
            ]
            db.add_all(rows)
            document.status = "ready"
            document.chunk_count = len(rows)
            document.error_message = None
            await db.commit()
            logger.info("Indexed document %s with %s chunks", document.id, len(rows))
            return {"status": "ready", "chunks": len(rows)}
        except Exception as exc:
            await db.rollback()
            document = await db.scalar(select(Document).where(Document.id == UUID(document_id)))
            if document:
                document.status = "failed"
                document.error_message = str(exc)[:2000]
                await db.commit()
            logger.exception("Document ingestion failed: %s", document_id)
            return {"status": "failed", "error": str(exc)}

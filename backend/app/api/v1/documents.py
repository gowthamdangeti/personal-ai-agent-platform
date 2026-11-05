import asyncio
import re
import uuid
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentRead
from app.services.document_extractor import SUPPORTED_EXTENSIONS
from app.services.storage import storage

router = APIRouter(prefix="/documents", tags=["documents"])


def safe_filename(filename: str) -> str:
    name = Path(filename or "upload").name
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:200] or "upload"


@router.get("", response_model=list[DocumentRead])
async def list_documents(db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(Document).order_by(Document.created_at.desc()).limit(100))).all())


@router.post("", response_model=DocumentRead, status_code=202)
async def upload_document(request: Request, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    filename = safe_filename(file.filename or "upload")
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
    data = await file.read(settings.max_upload_bytes + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_bytes // (1024 * 1024)} MB limit")
    document_id = uuid.uuid4()
    object_key = f"documents/{document_id}/{filename}"
    content_type = file.content_type or "application/octet-stream"
    await run_in_threadpool(storage.put_bytes, object_key, data, content_type)
    document = Document(
        id=document_id, filename=filename, content_type=content_type,
        object_key=object_key, size_bytes=len(data), status="uploaded",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    try:
        job = await request.app.state.arq_pool.enqueue_job("ingest_document", str(document.id))
        if job is None:
            raise RuntimeError("ARQ did not enqueue the job (a job with the same ID may already exist)")
    except Exception as exc:
        document.status = "failed"
        document.error_message = f"Could not queue ingestion: {exc}"[:2000]
        await db.commit()
        raise HTTPException(status_code=503, detail="Document was stored but processing could not be queued. Check Redis/worker and retry.") from exc
    return document


@router.post("/{document_id}/retry", response_model=DocumentRead, status_code=202)
async def retry_document(document_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    document.status = "uploaded"
    document.error_message = None
    await db.commit()
    await request.app.state.arq_pool.enqueue_job("ingest_document", str(document.id), _job_id=f"ingest-{document.id}-{uuid.uuid4()}")
    await db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: UUID, db: AsyncSession = Depends(get_db)):
    document = await db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    object_key = document.object_key
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    await db.delete(document)
    await db.commit()
    await run_in_threadpool(storage.delete, object_key)
    return None

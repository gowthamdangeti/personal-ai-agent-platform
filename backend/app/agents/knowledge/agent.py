from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.base import BaseAgent
from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.services.embeddings import embedding_provider
from app.services.llm import llm_service
from app.services.llm_resolver import ResolvedLLMConfig, resolve_llm_config


class KnowledgeAgent(BaseAgent):
    kind = "knowledge"

    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        if llm_config is None:
            llm_config = await resolve_llm_config(db, payload=payload)

        question = payload["question"]
        top_k = max(1, min(int(payload.get("top_k", settings.default_retrieval_k)), 12))
        query_vector = embedding_provider.embed(question)
        distance = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
        statement = (
            select(DocumentChunk, Document.filename, distance)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.status == "ready")
            .order_by(distance)
            .limit(top_k)
        )
        rows = (await db.execute(statement)).all()
        contexts: list[dict] = []
        for chunk, filename, score in rows:
            contexts.append({
                "chunk_id": str(chunk.id),
                "document_id": str(chunk.document_id),
                "filename": filename,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "distance": round(float(score), 5) if score is not None else None,
            })

        answer = await llm_service.answer_from_context(question, contexts, llm_config=llm_config)
        sources = [
            {
                "document_id": item["document_id"],
                "chunk_id": item["chunk_id"],
                "filename": item["filename"],
                "chunk_index": item["chunk_index"],
                "excerpt": item["content"][:350],
                "distance": item["distance"],
            }
            for item in contexts
        ]
        return {"answer": answer, "sources": sources}

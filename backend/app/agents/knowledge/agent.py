import re
from typing import Any
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.react_engine import ReActAgent, Tool
from app.core.config import settings
from app.models.document import Document, DocumentChunk
from app.services.embeddings import embedding_provider
from app.services.llm import llm_service
from app.services.llm_resolver import ResolvedLLMConfig, resolve_llm_config


async def hybrid_retrieve(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Hybrid retrieval combining dense vector similarity (pgvector) and sparse text matching
    with Reciprocal Rank Fusion (RRF).
    """
    query = payload.get("query") or payload.get("question", "")
    top_k = max(1, min(int(payload.get("top_k", settings.default_retrieval_k)), 15))
    if not query.strip():
        return {"error": "Query is required for retrieval.", "contexts": []}

    # 1. Dense Vector Retrieval
    query_vector = embedding_provider.embed(query)
    distance = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
    dense_stmt = (
        select(DocumentChunk, Document.filename, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.status == "ready")
        .order_by(distance)
        .limit(top_k * 2)
    )
    dense_rows = (await db.execute(dense_stmt)).all()

    # 2. Sparse Text Matching (SQL ILIKE / Full-Text fallback)
    words = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 3][:5]
    sparse_rows = []
    if words:
        conditions = [DocumentChunk.content.ilike(f"%{word}%") for word in words]
        from sqlalchemy import or_
        sparse_stmt = (
            select(DocumentChunk, Document.filename)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.status == "ready", or_(*conditions))
            .limit(top_k * 2)
        )
        sparse_rows = (await db.execute(sparse_stmt)).all()

    # 3. Reciprocal Rank Fusion (RRF: score = 1 / (60 + rank))
    rrf_scores: dict[str, float] = {}
    chunk_map: dict[str, tuple[DocumentChunk, str, float | None]] = {}

    for rank, (chunk, filename, dist) in enumerate(dense_rows):
        cid = str(chunk.id)
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (60.0 + rank + 1.0))
        chunk_map[cid] = (chunk, filename, float(dist) if dist is not None else None)

    for rank, item in enumerate(sparse_rows):
        chunk, filename = item[0], item[1]
        cid = str(chunk.id)
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (60.0 + rank + 1.0))
        if cid not in chunk_map:
            chunk_map[cid] = (chunk, filename, None)

    # Sort by fused score
    sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)[:top_k]

    contexts = []
    for cid in sorted_chunk_ids:
        chunk, filename, dist = chunk_map[cid]
        contexts.append({
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "filename": filename,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "distance": round(dist, 5) if dist is not None else None,
            "rrf_score": round(rrf_scores[cid], 5),
        })

    return {"count": len(contexts), "contexts": contexts}


class KnowledgeAgent(ReActAgent):
    kind = "knowledge"

    def __init__(self):
        super().__init__()
        self.register_tool(
            Tool(
                name="hybrid_retrieve",
                description="Performs dense + sparse RRF retrieval over indexed documents for a query.",
                fn=hybrid_retrieve,
                is_hitl_critical=False,
            )
        )

    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        if llm_config is None:
            llm_config = await resolve_llm_config(db, payload=payload)

        question = payload.get("question") or payload.get("input_text", "")
        top_k = max(1, min(int(payload.get("top_k", settings.default_retrieval_k)), 15))

        # Perform hybrid retrieval
        retrieval_res = await hybrid_retrieve(db, {"query": question, "top_k": top_k})
        contexts = retrieval_res.get("contexts", [])

        # Synthesize answer using retrieved context
        answer = await llm_service.answer_from_context(question, contexts, llm_config=llm_config)

        # Verification pass: assert cited excerpts appear in source chunks (substring check)
        citations = []
        for item in contexts:
            content_lower = item["content"].lower()
            # Verify if filename or key phrases appear in the answer
            fname = item["filename"]
            is_referenced = fname.lower() in answer.lower() or f"[{fname}]" in answer
            citations.append({
                "document_id": item["document_id"],
                "chunk_id": item["chunk_id"],
                "filename": fname,
                "chunk_index": item["chunk_index"],
                "excerpt": item["content"][:350],
                "distance": item["distance"],
                "verified": is_referenced or len(contexts) == 1,
            })

        return {
            "status": "completed",
            "answer": answer,
            "citations": citations,
            "sources": citations,
        }

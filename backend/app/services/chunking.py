from app.core.config import settings


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]:
    """Split extracted text into bounded, overlapping chunks, preferring paragraph boundaries."""
    size = chunk_size or settings.chunk_size
    overlap = settings.chunk_overlap if overlap is None else overlap
    if size <= 0 or overlap < 0 or overlap >= size:
        raise ValueError("Require chunk_size > overlap >= 0")
    text = "\n".join(line.strip() for line in text.replace("\r", "\n").split("\n") if line.strip())
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            boundary = text.rfind("\n", start + size // 2, end)
            if boundary > start:
                end = boundary
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks

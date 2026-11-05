from app.services.chunking import chunk_text


def test_chunk_text_returns_overlapping_chunks():
    text = "alpha " * 500
    chunks = chunk_text(text, chunk_size=400, overlap=50)
    assert len(chunks) > 1
    assert all(0 < len(chunk) <= 400 for chunk in chunks)


def test_chunk_text_empty_input():
    assert chunk_text("  \n ") == []

import pytest
from app.services.document_extractor import extract_text


def test_extract_text_file():
    assert extract_text("notes.txt", b"Hello\nAI agents") == "Hello\nAI agents"


def test_reject_unsupported_file():
    with pytest.raises(ValueError):
        extract_text("archive.zip", b"not a document")

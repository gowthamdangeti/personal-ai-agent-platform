from app.services.embeddings import embedding_provider


def test_embedding_has_expected_dimension_and_is_normalized():
    vector = embedding_provider.embed("Convozent knowledge assistant")
    assert len(vector) == embedding_provider.dimensions
    assert abs(sum(value * value for value in vector) ** 0.5 - 1.0) < 1e-8


def test_embedding_is_deterministic():
    text = "document processing agent"
    assert embedding_provider.embed(text) == embedding_provider.embed(text)

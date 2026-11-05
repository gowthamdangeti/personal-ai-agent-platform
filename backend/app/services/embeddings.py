"""Zero-key local embedding for development; replace with a semantic model for production."""
import hashlib
import math
import re
from app.core.config import settings


class LocalHashEmbeddingProvider:
    """Deterministic feature-hashing vector. Useful for wiring/testing, not semantic quality."""

    dimensions = settings.embedding_dimensions

    def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = re.findall(r"[a-z0-9_]+", text.lower())
        features = list(tokens)
        for token in tokens:
            if len(token) >= 4:
                features.extend(token[i:i + 3] for i in range(len(token) - 2))
        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "little") % self.dimensions
            sign = 1.0 if digest[4] & 1 else -1.0
            vector[index] += sign
        norm = math.sqrt(sum(value * value for value in vector))
        if norm:
            vector = [value / norm for value in vector]
        return vector


embedding_provider = LocalHashEmbeddingProvider()

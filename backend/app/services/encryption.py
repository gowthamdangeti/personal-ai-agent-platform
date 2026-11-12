import base64
import hashlib
import json
import logging
import re
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings

logger = logging.getLogger(__name__)


def _derive_fernet_key(seed: str) -> bytes:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


class EncryptionService:
    def __init__(self):
        self._fernet: Fernet | None = None

    def _get_fernet(self) -> Fernet:
        if self._fernet is not None:
            return self._fernet
        raw_key = (settings.byok_encryption_key or "").strip()
        if raw_key:
            try:
                # Validate key length for Fernet (32 bytes base64 encoded = 44 chars)
                decoded = base64.urlsafe_b64decode(raw_key)
                if len(decoded) == 32:
                    self._fernet = Fernet(raw_key.encode("utf-8"))
                    return self._fernet
                logger.warning("BYOK_ENCRYPTION_KEY is not 32 bytes; deriving Fernet key from it.")
            except Exception as exc:
                logger.warning("Failed to decode BYOK_ENCRYPTION_KEY (%s); falling back to secret_key derivation.", exc)
        key_bytes = _derive_fernet_key(settings.secret_key or "personal-ai-agent-platform-default-key")
        self._fernet = Fernet(key_bytes)
        return self._fernet

    def encrypt(self, plaintext: str) -> str:
        if not plaintext:
            raise ValueError("Cannot encrypt empty string")
        fernet = self._get_fernet()
        token = fernet.encrypt(plaintext.encode("utf-8"))
        return token.decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        if not ciphertext:
            raise ValueError("Cannot decrypt empty ciphertext")
        fernet = self._get_fernet()
        try:
            decrypted = fernet.decrypt(ciphertext.encode("utf-8"))
            return decrypted.decode("utf-8")
        except InvalidToken as exc:
            logger.error("Failed to decrypt API key token with the active key.")
            raise ValueError("Could not decrypt credential. Encryption key may have changed.") from exc

    def encrypt_payload(self, payload: dict) -> str:
        """Serializes and encrypts an arbitrary dictionary of sensitive credentials."""
        if not payload:
            return ""
        serialized = json.dumps(payload)
        return self.encrypt(serialized)

    def decrypt_payload(self, ciphertext: str | None) -> dict:
        """Decrypts and parses an encrypted JSON payload dictionary."""
        if not ciphertext:
            return {}
        try:
            decrypted_str = self.decrypt(ciphertext)
            return json.loads(decrypted_str)
        except Exception as exc:
            logger.error("Failed to decrypt sensitive payload: %s", exc)
            return {}

    @staticmethod
    def mask_key(key: str) -> str:
        if not key:
            return ""
        clean = key.strip()
        if len(clean) <= 8:
            return "****"
        # If key has a known prefix like sk- or gsk_
        prefix = ""
        suffix = clean[-4:]
        if clean.startswith("sk-ant-"):
            prefix = "sk-ant-"
        elif clean.startswith("sk-"):
            prefix = "sk-"
        elif clean.startswith("ghp_") or clean.startswith("github_pat_"):
            prefix = "ghp_"
        elif clean.startswith("gsk_"):
            prefix = "gsk_"
        elif len(clean) >= 12:
            prefix = clean[:4] + "-"
        else:
            prefix = clean[:3]
        return f"{prefix}****{suffix}"

    @classmethod
    def mask_secret(cls, secret: str, secret_type: str = "generic") -> str:
        """Masks arbitrary secrets based on type without leaking content."""
        if not secret:
            return ""
        clean = secret.strip()
        if secret_type == "connection_string":
            try:
                # Replace password portion in scheme://user:password@host:port/db
                return re.sub(r"(://[^:]+:)([^@]+)@", r"\1****@", clean)
            except Exception:
                return "connection://****"
        return cls.mask_key(clean)


encryption_service = EncryptionService()

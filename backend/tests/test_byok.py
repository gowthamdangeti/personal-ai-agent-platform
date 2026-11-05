import pytest
from app.services.encryption import EncryptionService, encryption_service
from app.services.ssrf import validate_safe_url
from app.schemas.credential import ProviderCredentialCreate, ProviderCredentialRead
from app.services.provider_validator import provider_validator
from app.services.llm_resolver import resolve_llm_config, ResolvedLLMConfig
from app.models.credential import ProviderCredential
from app.core.config import settings


def test_encryption_roundtrip():
    service = EncryptionService()
    secret = "sk-live-1234567890abcdefghijklmnopqrstuvwxyz"
    encrypted = service.encrypt(secret)
    assert encrypted != secret
    decrypted = service.decrypt(encrypted)
    assert decrypted == secret


def test_encryption_empty_fails():
    service = EncryptionService()
    with pytest.raises(ValueError):
        service.encrypt("")


def test_key_masking():
    # Long OpenAI key
    masked_openai = EncryptionService.mask_key("sk-abcdef1234567890xyz")
    assert masked_openai.startswith("sk-")
    assert masked_openai.endswith("0xyz")
    assert "abcdef" not in masked_openai

    # Anthropic key
    masked_anthropic = EncryptionService.mask_key("sk-ant-api03-123456789-abcd")
    assert masked_anthropic.startswith("sk-ant-")
    assert masked_anthropic.endswith("abcd")
    assert "api03" not in masked_anthropic

    # Groq key
    masked_groq = EncryptionService.mask_key("gsk_1234567890abcdef")
    assert masked_groq.startswith("gsk_")
    assert masked_groq.endswith("cdef")

    # Short key
    assert EncryptionService.mask_key("short") == "****"
    assert EncryptionService.mask_key("") == ""


def test_ssrf_validator_blocks_private_networks():
    # Loopback & localhost
    with pytest.raises(ValueError, match="prohibited for security reasons|private or restricted"):
        validate_safe_url("http://localhost:8000/v1")
    with pytest.raises(ValueError, match="prohibited for security reasons|private or restricted"):
        validate_safe_url("http://127.0.0.1:8000/v1")
    with pytest.raises(ValueError, match="prohibited for security reasons|private or restricted"):
        validate_safe_url("http://0.0.0.0:8000/v1")

    # Cloud metadata
    with pytest.raises(ValueError, match="private or restricted"):
        validate_safe_url("http://169.254.169.254/latest/meta-data/")

    # Private RFC1918 IPs
    with pytest.raises(ValueError, match="private or restricted"):
        validate_safe_url("http://10.0.0.5:8080/v1")
    with pytest.raises(ValueError, match="private or restricted"):
        validate_safe_url("http://192.168.1.100:8000/v1")
    with pytest.raises(ValueError, match="private or restricted"):
        validate_safe_url("http://172.20.0.5:8000/v1")

    # Non-HTTP schemes
    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_safe_url("ftp://example.com/v1")
    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_safe_url("file:///etc/passwd")


def test_ssrf_validator_allows_valid_public_urls():
    url1 = validate_safe_url("https://api.openai.com/v1")
    assert url1 == "https://api.openai.com/v1"

    url2 = validate_safe_url("https://api.together.xyz/v1/")
    assert url2 == "https://api.together.xyz/v1"


@pytest.mark.asyncio
async def test_provider_validator_empty_key():
    result = await provider_validator.test_connection(provider="openai", api_key="")
    assert not result.success
    assert "cannot be empty" in result.message


@pytest.mark.asyncio
async def test_provider_validator_custom_requires_base_url():
    result = await provider_validator.test_connection(provider="custom", api_key="some-key", base_url="")
    assert not result.success
    assert "Base URL is required" in result.message


@pytest.mark.asyncio
async def test_provider_validator_custom_ssrf_blocked():
    result = await provider_validator.test_connection(
        provider="custom",
        api_key="some-key",
        base_url="http://127.0.0.1:8000/v1",
    )
    assert not result.success
    assert "SSRF" in result.message or "prohibited" in result.message


def test_schema_never_contains_decrypted_key():
    raw_secret = "sk-super-secret-production-key-9999"
    encrypted = encryption_service.encrypt(raw_secret)
    read_obj = ProviderCredentialRead(
        id="11111111-1111-1111-1111-111111111111",
        provider="openai",
        name="Test Key",
        masked_api_key=encryption_service.mask_key(raw_secret),
        model_name="gpt-4o-mini",
        base_url=None,
        is_active=True,
        is_default=True,
        created_at="2026-11-05T00:00:00Z",
        updated_at="2026-11-05T00:00:00Z",
    )
    serialized = read_obj.model_dump_json()
    assert raw_secret not in serialized
    assert encrypted not in serialized
    assert "sk-****9999" in serialized


import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

SUPPORTED_PROVIDERS = [
    "openai",
    "gemini",
    "groq",
    "deepseek",
    "openrouter",
    "anthropic",
    "custom",
]

DEFAULT_PROVIDER_MODELS = {
    "openai": "gpt-4o-mini",
    "gemini": "gemini-1.5-flash",
    "groq": "llama-3.3-70b-versatile",
    "deepseek": "deepseek-chat",
    "openrouter": "openai/gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-latest",
    "custom": "default",
}


class ProviderCredentialCreate(BaseModel):
    provider: str = Field(..., description="Provider identifier (e.g. openai, gemini, groq, etc.)")
    name: str | None = Field(default=None, max_length=100)
    api_key: str = Field(..., min_length=1, max_length=1000, description="Plaintext API key to be encrypted")
    model_name: str = Field(default="", max_length=120)
    base_url: str | None = Field(default=None, max_length=500)
    is_default: bool = False


class ProviderCredentialUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    api_key: str | None = Field(default=None, min_length=1, max_length=1000)
    model_name: str | None = Field(default=None, max_length=120)
    base_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    is_default: bool | None = None


class ProviderCredentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    name: str | None
    masked_api_key: str
    model_name: str
    base_url: str | None
    is_active: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime


class ProviderTestRequest(BaseModel):
    provider: str
    api_key: str | None = None
    model_name: str | None = None
    base_url: str | None = None


class ProviderTestResult(BaseModel):
    success: bool
    message: str
    provider: str
    model: str | None = None
    latency_ms: int | None = None


class SetDefaultProviderRequest(BaseModel):
    provider_id: uuid.UUID


class ProviderCatalogItem(BaseModel):
    id: str
    name: str
    description: str
    default_model: str
    suggested_models: list[str]
    requires_base_url: bool
    default_base_url: str | None


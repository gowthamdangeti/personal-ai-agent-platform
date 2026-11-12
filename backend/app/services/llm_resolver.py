from dataclasses import dataclass
import uuid
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_PROVIDER_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "groq": "https://api.groq.com/openai/v1",
    "deepseek": "https://api.deepseek.com",
    "openrouter": "https://openrouter.ai/api/v1",
    "anthropic": "https://api.anthropic.com/v1",
}


@dataclass
class ResolvedLLMConfig:
    provider: str
    api_key: str
    model: str
    base_url: str | None = None
    credential_id: uuid.UUID | None = None
    credential_name: str | None = None


async def resolve_llm_config(
    db: AsyncSession,
    payload: dict | None = None,
    agent_config: dict | None = None,
    user_id: str | None = "default",
) -> ResolvedLLMConfig | None:
    """
    Backwards-compatible wrapper delegating to the centralized CredentialResolver.
    """
    from app.services.credential_resolver import credential_resolver
    return await credential_resolver.resolve_llm_config(
        db=db,
        payload=payload,
        agent_config=agent_config,
        user_id=user_id,
    )

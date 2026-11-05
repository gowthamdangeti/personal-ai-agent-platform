from dataclasses import dataclass
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.credential import ProviderCredential
from app.services.encryption import encryption_service

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
    Resolves the LLM provider, API key, model, and base URL hierarchically:
    1. Payload-specified credential_id or provider
    2. Agent-level config-specified credential_id or provider
    3. Default active ProviderCredential in database
    4. Most recently updated active ProviderCredential in database
    5. Environment variable fallback (LLM_API_KEY)
    6. None (triggering preview / unconfigured behavior)
    """
    payload = payload or {}
    agent_config = agent_config or {}

    cred: ProviderCredential | None = None

    # 1. Direct credential ID in payload or agent_config
    cred_id_str = payload.get("credential_id") or agent_config.get("credential_id")
    if cred_id_str:
        try:
            target_id = uuid.UUID(str(cred_id_str))
            cred = await db.get(ProviderCredential, target_id)
            if cred and not cred.is_active:
                cred = None
        except (ValueError, TypeError):
            cred = None

    # 2. Specific provider requested in payload or agent_config
    if cred is None:
        target_prov = payload.get("provider") or agent_config.get("provider")
        if target_prov:
            prov_lower = str(target_prov).lower().strip()
            statement = (
                select(ProviderCredential)
                .where(
                    ProviderCredential.provider == prov_lower,
                    ProviderCredential.is_active.is_(True),
                )
                .order_by(
                    ProviderCredential.is_default.desc(),
                    ProviderCredential.updated_at.desc(),
                )
            )
            cred = await db.scalar(statement)

    # 3. Default active provider in database
    if cred is None:
        statement = select(ProviderCredential).where(
            ProviderCredential.is_default.is_(True),
            ProviderCredential.is_active.is_(True),
        )
        cred = await db.scalar(statement)

    # 4. Any active provider in database (most recently updated first)
    if cred is None:
        statement = (
            select(ProviderCredential)
            .where(ProviderCredential.is_active.is_(True))
            .order_by(ProviderCredential.updated_at.desc())
        )
        cred = await db.scalar(statement)

    # If a database credential was found, decrypt and return
    if cred is not None:
        try:
            plain_key = encryption_service.decrypt(cred.encrypted_api_key)
        except Exception:
            plain_key = ""

        if plain_key:
            # Model override priority: payload > agent_config > credential default
            model = (
                payload.get("model")
                or agent_config.get("model")
                or cred.model_name
            )
            # Base URL resolution
            base_url = cred.base_url or DEFAULT_PROVIDER_BASE_URLS.get(cred.provider.lower())
            return ResolvedLLMConfig(
                provider=cred.provider.lower(),
                api_key=plain_key,
                model=model,
                base_url=base_url,
                credential_id=cred.id,
                credential_name=cred.name,
            )

    # 5. Environment variable fallback
    if settings.llm_api_key:
        model = payload.get("model") or agent_config.get("model") or settings.llm_model
        return ResolvedLLMConfig(
            provider="openai_env",
            api_key=settings.llm_api_key,
            model=model,
            base_url=settings.llm_base_url,
            credential_id=None,
            credential_name="Environment Key",
        )

    # 6. No provider available
    return None


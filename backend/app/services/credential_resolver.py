from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
from typing import Any
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.credential import AgentCredentialAssignment, ProviderCredential
from app.services.encryption import encryption_service
from app.services.llm_resolver import DEFAULT_PROVIDER_BASE_URLS, ResolvedLLMConfig

logger = logging.getLogger(__name__)


@dataclass
class DecryptedCredential:
    id: uuid.UUID
    category: str
    provider: str
    name: str | None
    secrets: dict[str, str] = field(default_factory=dict)
    config: dict[str, Any] = field(default_factory=dict)
    model_name: str | None = None
    base_url: str | None = None
    scopes: list[str] = field(default_factory=list)
    is_default: bool = False


class CredentialResolver:
    """
    Centralized, dynamic resolver that queries encrypted credentials from PostgreSQL,
    enforces agent-to-credential permissions, tracks execution usage, and handles
    safe decryption without secret leakage.
    """

    async def _touch_usage(self, db: AsyncSession, cred_id: uuid.UUID) -> None:
        """Atomically increment usage_count and update last_used_at."""
        try:
            now = datetime.now(timezone.utc)
            await db.execute(
                update(ProviderCredential)
                .where(ProviderCredential.id == cred_id)
                .values(
                    usage_count=ProviderCredential.usage_count + 1,
                    last_used_at=now,
                )
            )
            await db.commit()
        except Exception as exc:
            logger.debug("Failed to update credential usage tracking: %s", exc)

    def _decrypt_credential(self, cred: ProviderCredential) -> DecryptedCredential:
        secrets: dict[str, str] = {}

        # 1. Decrypt JSON payload if present
        if cred.encrypted_secret_payload:
            try:
                secrets = encryption_service.decrypt_payload(cred.encrypted_secret_payload)
            except Exception as exc:
                logger.error("Failed to decrypt secret payload for credential %s: %s", cred.id, exc)

        # 2. Legacy encrypted_api_key field backward compatibility
        if cred.encrypted_api_key and not secrets.get("api_key"):
            try:
                decrypted_key = encryption_service.decrypt(cred.encrypted_api_key)
                secrets["api_key"] = decrypted_key
            except Exception as exc:
                logger.error("Failed to decrypt legacy api key for credential %s: %s", cred.id, exc)

        return DecryptedCredential(
            id=cred.id,
            category=cred.category,
            provider=cred.provider,
            name=cred.name,
            secrets=secrets,
            config=cred.non_secret_config or {},
            model_name=cred.model_name,
            base_url=cred.base_url,
            scopes=cred.scopes or [],
            is_default=cred.is_default,
        )

    async def resolve_raw_credential(
        self,
        db: AsyncSession,
        category: str,
        provider: str | None = None,
        credential_id: uuid.UUID | str | None = None,
        agent_id: uuid.UUID | str | None = None,
    ) -> DecryptedCredential | None:
        """
        Dynamically finds and decrypts the appropriate credential using precedence:
        1. Explicit credential_id
        2. Agent-assigned credential for that category/provider
        3. Category default active credential
        4. Category + provider active credential
        5. Any active credential in that category
        """
        cred: ProviderCredential | None = None
        cat = category.lower().strip()

        # 1. Explicit credential_id
        if credential_id:
            try:
                cid = uuid.UUID(str(credential_id))
                cred = await db.get(ProviderCredential, cid)
                if cred and not cred.is_active:
                    cred = None
            except (ValueError, TypeError):
                cred = None

        # 2. Agent-assigned credential
        if cred is None and agent_id:
            try:
                aid = uuid.UUID(str(agent_id))
                stmt = (
                    select(ProviderCredential)
                    .join(AgentCredentialAssignment, AgentCredentialAssignment.credential_id == ProviderCredential.id)
                    .where(
                        AgentCredentialAssignment.agent_id == aid,
                        ProviderCredential.category == cat,
                        ProviderCredential.is_active.is_(True),
                    )
                )
                if provider:
                    stmt = stmt.where(ProviderCredential.provider == provider.lower().strip())
                stmt = stmt.order_by(ProviderCredential.is_default.desc(), ProviderCredential.updated_at.desc())
                cred = await db.scalar(stmt)
            except Exception as exc:
                logger.debug("Failed checking agent assignments: %s", exc)

        # 3. Category default active credential
        if cred is None:
            stmt = select(ProviderCredential).where(
                ProviderCredential.category == cat,
                ProviderCredential.is_default.is_(True),
                ProviderCredential.is_active.is_(True),
            )
            if provider:
                stmt = stmt.where(ProviderCredential.provider == provider.lower().strip())
            cred = await db.scalar(stmt)

        # 4. Any matching provider in category
        if cred is None and provider:
            stmt = (
                select(ProviderCredential)
                .where(
                    ProviderCredential.category == cat,
                    ProviderCredential.provider == provider.lower().strip(),
                    ProviderCredential.is_active.is_(True),
                )
                .order_by(ProviderCredential.updated_at.desc())
            )
            cred = await db.scalar(stmt)

        # 5. Any active credential in category
        if cred is None:
            stmt = (
                select(ProviderCredential)
                .where(
                    ProviderCredential.category == cat,
                    ProviderCredential.is_active.is_(True),
                )
                .order_by(ProviderCredential.is_default.desc(), ProviderCredential.updated_at.desc())
            )
            cred = await db.scalar(stmt)

        if cred is not None:
            await self._touch_usage(db, cred.id)
            return self._decrypt_credential(cred)

        return None

    # ----------------------------------------------------
    # Specialized Resolvers
    # ----------------------------------------------------

    async def resolve_llm_config(
        self,
        db: AsyncSession,
        payload: dict | None = None,
        agent_config: dict | None = None,
        agent_id: uuid.UUID | str | None = None,
        user_id: str | None = "default",
    ) -> ResolvedLLMConfig | None:
        """
        Drop-in replacement for the previous resolve_llm_config function.
        Resolves LLM credential from database vault, then falls back to settings.llm_api_key.
        """
        payload = payload or {}
        agent_config = agent_config or {}

        cred_id = payload.get("credential_id") or agent_config.get("credential_id")
        provider_req = payload.get("provider") or agent_config.get("provider")

        resolved = await self.resolve_raw_credential(
            db=db,
            category="llm",
            provider=str(provider_req) if provider_req else None,
            credential_id=cred_id,
            agent_id=agent_id,
        )

        if resolved is not None:
            plain_key = resolved.secrets.get("api_key", "")
            if plain_key:
                model = (
                    payload.get("model")
                    or agent_config.get("model")
                    or resolved.model_name
                    or "gpt-4o-mini"
                )
                base_url = resolved.base_url or DEFAULT_PROVIDER_BASE_URLS.get(resolved.provider.lower())
                return ResolvedLLMConfig(
                    provider=resolved.provider.lower(),
                    api_key=plain_key,
                    model=model,
                    base_url=base_url,
                    credential_id=resolved.id,
                    credential_name=resolved.name,
                )

        # Fallback to ENV setting if available during transition
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

        return None

    async def resolve_research(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID | str | None = None,
        payload: dict | None = None,
    ) -> dict[str, Any]:
        """Resolves Tavily, Serper, or SearXNG search configuration."""
        payload = payload or {}
        target_provider = payload.get("search_provider")

        # 1. Check BYOK vault for research provider
        resolved = await self.resolve_raw_credential(
            db=db,
            category="research",
            provider=target_provider,
            agent_id=agent_id,
        )

        if resolved is not None:
            if resolved.provider == "tavily":
                return {
                    "provider": "tavily",
                    "api_key": resolved.secrets.get("api_key", ""),
                    "config": resolved.config,
                }
            elif resolved.provider == "serper":
                return {
                    "provider": "serper",
                    "api_key": resolved.secrets.get("api_key", ""),
                    "config": resolved.config,
                }
            elif resolved.provider == "searxng":
                return {
                    "provider": "searxng",
                    "base_url": resolved.base_url or resolved.config.get("base_url"),
                    "api_key": resolved.secrets.get("api_key"),
                }

        # 2. Check legacy environment settings
        if getattr(settings, "tavily_api_key", None):
            return {"provider": "tavily", "api_key": settings.tavily_api_key, "config": {}}
        if getattr(settings, "searxng_url", None):
            return {"provider": "searxng", "base_url": settings.searxng_url, "api_key": None}

        # 3. Fallback
        return {"provider": "offline", "api_key": None}

    async def resolve_jira(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID | str | None = None,
        payload: dict | None = None,
    ) -> dict[str, Any] | None:
        """Resolves Jira credentials."""
        resolved = await self.resolve_raw_credential(
            db=db,
            category="project_management",
            provider="jira",
            agent_id=agent_id,
        )

        if resolved is not None:
            return {
                "site_url": resolved.config.get("site_url") or resolved.base_url,
                "email": resolved.config.get("email"),
                "api_token": resolved.secrets.get("api_token") or resolved.secrets.get("api_key"),
                "project_key": resolved.config.get("project_key", "ENG"),
                "cloud_id": resolved.config.get("cloud_id"),
            }

        # ENV fallback
        if getattr(settings, "jira_api_token", None) and getattr(settings, "jira_base_url", None):
            return {
                "site_url": settings.jira_base_url,
                "email": getattr(settings, "jira_user_email", ""),
                "api_token": settings.jira_api_token,
                "project_key": "ENG",
            }

        return None

    async def resolve_github(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID | str | None = None,
        payload: dict | None = None,
    ) -> dict[str, Any] | None:
        """Resolves GitHub developer credentials."""
        resolved = await self.resolve_raw_credential(
            db=db,
            category="developer",
            provider="github",
            agent_id=agent_id,
        )

        if resolved is not None:
            return {
                "api_token": resolved.secrets.get("api_token") or resolved.secrets.get("api_key"),
                "default_org": resolved.config.get("default_org"),
                "default_repo": resolved.config.get("default_repo"),
            }

        return None

    async def resolve_monitoring(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID | str | None = None,
        payload: dict | None = None,
    ) -> dict[str, Any] | None:
        """Resolves Prometheus or Grafana monitoring credentials."""
        resolved = await self.resolve_raw_credential(
            db=db,
            category="monitoring",
            provider=payload.get("monitoring_provider") if payload else None,
            agent_id=agent_id,
        )

        if resolved is not None:
            return {
                "provider": resolved.provider,
                "base_url": resolved.base_url or resolved.config.get("base_url"),
                "auth_token": resolved.secrets.get("auth_token") or resolved.secrets.get("api_key"),
                "username": resolved.config.get("username"),
            }

        # ENV fallback
        if getattr(settings, "prometheus_url", None):
            return {
                "provider": "prometheus",
                "base_url": settings.prometheus_url,
                "auth_token": None,
                "username": None,
            }

        return None

    async def resolve_database(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID | str | None = None,
        payload: dict | None = None,
    ) -> dict[str, Any] | None:
        """Resolves external database credentials for Data Analyst text-to-SQL."""
        resolved = await self.resolve_raw_credential(
            db=db,
            category="database",
            agent_id=agent_id,
        )

        if resolved is not None:
            conn_str = resolved.secrets.get("connection_string")
            if not conn_str and resolved.config.get("host"):
                host = resolved.config.get("host")
                port = resolved.config.get("port", 5432)
                db_name = resolved.config.get("database")
                user = resolved.config.get("username")
                pw = resolved.secrets.get("password", "")
                conn_str = f"postgresql+asyncpg://{user}:{pw}@{host}:{port}/{db_name}"
            return {
                "provider": resolved.provider,
                "connection_string": conn_str,
                "config": resolved.config,
            }

        # ENV fallback
        if getattr(settings, "read_only_database_url", None):
            return {
                "provider": "postgres",
                "connection_string": settings.read_only_database_url,
                "config": {},
            }

        return None

    async def resolve_embedding(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID | str | None = None,
    ) -> dict[str, Any]:
        """Resolves embedding provider."""
        resolved = await self.resolve_raw_credential(
            db=db,
            category="embedding",
            agent_id=agent_id,
        )

        if resolved is not None:
            return {
                "provider": resolved.provider,
                "api_key": resolved.secrets.get("api_key"),
                "model_name": resolved.model_name or resolved.config.get("model_name"),
                "dimensions": int(resolved.config.get("dimensions", settings.embedding_dimensions)),
            }

        return {
            "provider": "local_embeddings",
            "api_key": None,
            "model_name": "local-hash-384",
            "dimensions": settings.embedding_dimensions,
        }


credential_resolver = CredentialResolver()


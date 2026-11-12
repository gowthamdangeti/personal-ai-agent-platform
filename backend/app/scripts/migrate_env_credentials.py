"""
Migration utility to discover external credentials from environment configuration
and securely persist them in the centralized encrypted BYOK database vault.

SECURITY MANDATE:
- Never log, display, or leak plaintext secret keys or tokens.
- Keep infrastructure secrets (DATABASE_URL, REDIS_URL, MinIO, BYOK_ENCRYPTION_KEY, SECRET_KEY) in ENV.
- Only migrate external service integrations.
"""

import asyncio
import logging
from sqlalchemy import select
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.credential import ProviderCredential
from app.services.encryption import encryption_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


async def migrate_env_credentials() -> dict[str, int]:
    logger.info("Initiating environment credentials discovery and vault migration...")
    migrated_count = 0
    skipped_count = 0

    async with AsyncSessionLocal() as db:
        # 1. LLM API Key
        if settings.llm_api_key and settings.llm_api_key.strip():
            prov = "openai"
            if "deepseek" in (settings.llm_model or "").lower():
                prov = "deepseek"
            elif "groq" in (settings.llm_model or "").lower():
                prov = "groq"
            elif "gemini" in (settings.llm_model or "").lower():
                prov = "gemini"

            existing = await db.scalar(
                select(ProviderCredential).where(
                    ProviderCredential.category == "llm",
                    ProviderCredential.provider == prov,
                )
            )
            if not existing:
                encrypted_key = encryption_service.encrypt(settings.llm_api_key.strip())
                encrypted_payload = encryption_service.encrypt_payload({"api_key": settings.llm_api_key.strip()})
                cred = ProviderCredential(
                    category="llm",
                    provider=prov,
                    name=f"Migrated {prov.capitalize()} Key",
                    encrypted_api_key=encrypted_key,
                    encrypted_secret_payload=encrypted_payload,
                    model_name=settings.llm_model or "gpt-4o-mini",
                    base_url=settings.llm_base_url,
                    is_active=True,
                    is_default=True,
                    connection_status="untested",
                )
                db.add(cred)
                migrated_count += 1
                logger.info("Migrated LLM provider: %s (model: %s)", prov, settings.llm_model)
            else:
                skipped_count += 1
                logger.info("LLM provider '%s' already exists in vault; skipping.", prov)

        # 2. Tavily Search
        if getattr(settings, "tavily_api_key", None) and settings.tavily_api_key.strip():
            existing = await db.scalar(
                select(ProviderCredential).where(
                    ProviderCredential.category == "research",
                    ProviderCredential.provider == "tavily",
                )
            )
            if not existing:
                encrypted_payload = encryption_service.encrypt_payload({"api_key": settings.tavily_api_key.strip()})
                cred = ProviderCredential(
                    category="research",
                    provider="tavily",
                    name="Migrated Tavily Search",
                    encrypted_api_key=encryption_service.encrypt(settings.tavily_api_key.strip()),
                    encrypted_secret_payload=encrypted_payload,
                    is_active=True,
                    is_default=True,
                    connection_status="untested",
                )
                db.add(cred)
                migrated_count += 1
                logger.info("Migrated Research provider: tavily")
            else:
                skipped_count += 1

        # 3. SearXNG Metasearch
        if getattr(settings, "searxng_url", None) and settings.searxng_url.strip():
            existing = await db.scalar(
                select(ProviderCredential).where(
                    ProviderCredential.category == "research",
                    ProviderCredential.provider == "searxng",
                )
            )
            if not existing:
                cred = ProviderCredential(
                    category="research",
                    provider="searxng",
                    name="Migrated SearXNG",
                    base_url=settings.searxng_url.strip(),
                    non_secret_config={"base_url": settings.searxng_url.strip()},
                    is_active=True,
                    is_default=False,
                    connection_status="untested",
                )
                db.add(cred)
                migrated_count += 1
                logger.info("Migrated Research provider: searxng")
            else:
                skipped_count += 1

        # 4. Jira Integration
        if (
            getattr(settings, "jira_api_token", None)
            and settings.jira_api_token.strip()
            and getattr(settings, "jira_base_url", None)
        ):
            existing = await db.scalar(
                select(ProviderCredential).where(
                    ProviderCredential.category == "project_management",
                    ProviderCredential.provider == "jira",
                )
            )
            if not existing:
                encrypted_payload = encryption_service.encrypt_payload({
                    "api_token": settings.jira_api_token.strip(),
                })
                cred = ProviderCredential(
                    category="project_management",
                    provider="jira",
                    name="Migrated Atlassian Jira",
                    encrypted_secret_payload=encrypted_payload,
                    non_secret_config={
                        "site_url": settings.jira_base_url.strip(),
                        "email": getattr(settings, "jira_user_email", "").strip(),
                        "project_key": "ENG",
                    },
                    base_url=settings.jira_base_url.strip(),
                    is_active=True,
                    is_default=True,
                    connection_status="untested",
                )
                db.add(cred)
                migrated_count += 1
                logger.info("Migrated Project Management provider: jira")
            else:
                skipped_count += 1

        # 5. Prometheus Telemetry
        if getattr(settings, "prometheus_url", None) and settings.prometheus_url.strip():
            existing = await db.scalar(
                select(ProviderCredential).where(
                    ProviderCredential.category == "monitoring",
                    ProviderCredential.provider == "prometheus",
                )
            )
            if not existing:
                cred = ProviderCredential(
                    category="monitoring",
                    provider="prometheus",
                    name="Migrated Prometheus",
                    base_url=settings.prometheus_url.strip(),
                    non_secret_config={"base_url": settings.prometheus_url.strip()},
                    is_active=True,
                    is_default=True,
                    connection_status="untested",
                )
                db.add(cred)
                migrated_count += 1
                logger.info("Migrated Monitoring provider: prometheus")
            else:
                skipped_count += 1

        # 6. Read-Only Analytics Database
        if getattr(settings, "read_only_database_url", None) and settings.read_only_database_url.strip():
            existing = await db.scalar(
                select(ProviderCredential).where(
                    ProviderCredential.category == "database",
                    ProviderCredential.provider == "postgres",
                )
            )
            if not existing:
                encrypted_payload = encryption_service.encrypt_payload({
                    "connection_string": settings.read_only_database_url.strip(),
                })
                cred = ProviderCredential(
                    category="database",
                    provider="postgres",
                    name="Migrated Read-Only Database",
                    encrypted_secret_payload=encrypted_payload,
                    is_active=True,
                    is_default=True,
                    connection_status="untested",
                )
                db.add(cred)
                migrated_count += 1
                logger.info("Migrated Database provider: postgres")
            else:
                skipped_count += 1

        await db.commit()

    logger.info("Migration finished: %d imported, %d skipped.", migrated_count, skipped_count)
    return {"migrated": migrated_count, "skipped": skipped_count}


if __name__ == "__main__":
    asyncio.run(migrate_env_credentials())


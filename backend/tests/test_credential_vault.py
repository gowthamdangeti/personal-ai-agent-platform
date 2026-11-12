import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.agent import Agent
from app.models.credential import AgentCredentialAssignment, ProviderCredential
from app.services.credential_resolver import credential_resolver
from app.services.encryption import encryption_service
from app.services.integrations.catalog import (
    INTEGRATION_CATALOG,
    get_catalog_by_category,
    get_catalog_item,
)
from app.services.integrations.validator import integration_validator

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


def test_encryption_payload_roundtrip():
    """Verify arbitrary secret dictionary encryption, decryption, and masking."""
    secrets = {
        "api_token": "secret_token_1234567890",
        "password": "my_super_secret_password!",
        "connection_string": "postgresql://user:pass123@db.prod.internal:5432/corp",
    }
    encrypted = encryption_service.encrypt_payload(secrets)
    assert encrypted != ""
    assert "secret_token" not in encrypted
    assert "my_super_secret" not in encrypted

    decrypted = encryption_service.decrypt_payload(encrypted)
    assert decrypted == secrets

    # Masking tests
    assert encryption_service.mask_secret(secrets["api_token"]) == "secr-****7890"
    masked_conn = encryption_service.mask_secret(secrets["connection_string"], "connection_string")
    assert "pass123" not in masked_conn
    assert "user:****@db.prod.internal" in masked_conn


def test_integration_catalog_completeness():
    """Verify that catalog covers all 8 categories."""
    categories = {item.category for item in INTEGRATION_CATALOG}
    expected = {
        "llm",
        "embedding",
        "research",
        "project_management",
        "developer",
        "monitoring",
        "database",
        "custom",
    }
    assert expected.issubset(categories)

    openai_item = get_catalog_item("openai")
    assert openai_item is not None
    assert openai_item.category == "llm"

    jira_item = get_catalog_item("jira")
    assert jira_item is not None
    assert jira_item.category == "project_management"

    db_items = get_catalog_by_category("database")
    assert any(i.id == "postgres" for i in db_items)


@pytest.mark.asyncio
async def test_integration_validator_validation():
    """Verify validator handles missing keys, offline fallback, and simulated probes."""
    # Empty key for LLM returns failure
    res_empty = await integration_validator.test_connection(
        category="llm", provider="openai", secrets={}, config={}
    )
    assert res_empty.success is False
    assert "API key is required" in res_empty.message

    # Local embeddings always succeeds
    res_local = await integration_validator.test_connection(
        category="embedding", provider="local_embeddings", secrets={}, config={}
    )
    assert res_local.success is True

    # SSRF protection blocks private IP loopback URLs
    res_ssrf = await integration_validator.test_connection(
        category="custom",
        provider="custom_webhook",
        secrets={"auth_secret": "test"},
        config={"base_url": "http://169.254.169.254/latest/meta-data"},
    )
    assert res_ssrf.success is False
    assert "restricted" in res_ssrf.message.lower() or "ssrf" in res_ssrf.message.lower() or "prohibited" in res_ssrf.message.lower()


@pytest.mark.asyncio
async def test_credential_resolver_flow():
    """Verify dynamic resolution precedence, agent assignment, and usage tracking."""
    async with TestSessionLocal() as db_session:
        # 1. Create an agent
        agent = Agent(
            name="Research Specialist",
            slug=f"research-specialist-{uuid.uuid4().hex[:6]}",
            kind="research",
        )
        db_session.add(agent)
        await db_session.commit()
        await db_session.refresh(agent)

        # 2. Create a global default research credential
        global_cred = ProviderCredential(
            category="research",
            provider="tavily",
            name="Global Tavily",
            encrypted_secret_payload=encryption_service.encrypt_payload({"api_key": "tvly-global-12345"}),
            is_default=True,
            is_active=True,
        )
        db_session.add(global_cred)

        # 3. Create an agent-specific research credential
        agent_cred = ProviderCredential(
            category="research",
            provider="serper",
            name="Agent-Specific Serper",
            encrypted_secret_payload=encryption_service.encrypt_payload({"api_key": "serper-agent-99999"}),
            is_default=False,
            is_active=True,
        )
        db_session.add(agent_cred)
        await db_session.commit()
        await db_session.refresh(agent_cred)

        # Assign agent_cred to agent
        assignment = AgentCredentialAssignment(agent_id=agent.id, credential_id=agent_cred.id)
        db_session.add(assignment)
        await db_session.commit()

        # 4. Resolve without agent_id -> gets global Tavily
        unassigned_res = await credential_resolver.resolve_research(db_session)
        assert unassigned_res["provider"] == "tavily"
        assert unassigned_res["api_key"] == "tvly-global-12345"

        # 5. Resolve with agent_id -> gets assigned Serper
        assigned_res = await credential_resolver.resolve_research(db_session, agent_id=agent.id)
        assert assigned_res["provider"] == "serper"
        assert assigned_res["api_key"] == "serper-agent-99999"

        # 6. Verify usage count incremented
        await db_session.refresh(agent_cred)
        assert agent_cred.usage_count >= 1
        assert agent_cred.last_used_at is not None

        # Clean up
        await db_session.delete(assignment)
        await db_session.delete(agent_cred)
        await db_session.delete(global_cred)
        await db_session.delete(agent)
        await db_session.commit()


@pytest.mark.asyncio
async def test_integrations_api_crud_and_masking():
    """Verify API routes for catalog, credential creation, masking, and agent assignment."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get Catalog
        res_cat = await client.get("/api/v1/integrations/catalog")
        assert res_cat.status_code == 200
        cat_items = res_cat.json()
        assert len(cat_items) >= 8

        # 2. Create Jira Credential
        jira_payload = {
            "category": "project_management",
            "provider": "jira",
            "name": "Corporate Jira Cloud",
            "secrets": {"api_token": "ATATT_super_secret_jira_token_xyz123"},
            "config": {
                "site_url": "https://company.atlassian.net",
                "email": "lead@company.com",
                "project_key": "AGENT",
            },
            "is_default": True,
        }
        res_create = await client.post("/api/v1/integrations/credentials", json=jira_payload)
        assert res_create.status_code == 201
        data = res_create.json()
        assert data["category"] == "project_management"
        assert data["provider"] == "jira"
        assert data["is_default"] is True
        # Plaintext secret MUST NOT be returned
        assert "super_secret" not in str(data)
        assert "masked_secrets" in data
        assert "ATAT" in data["masked_secrets"]["api_token"] or "****" in data["masked_secrets"]["api_token"]

        cred_id = data["id"]

        # 3. List Credentials
        res_list = await client.get("/api/v1/integrations/credentials?category=project_management")
        assert res_list.status_code == 200
        items = res_list.json()
        assert any(i["id"] == cred_id for i in items)

        # 4. Test Saved Credential
        res_test = await client.post(f"/api/v1/integrations/credentials/{cred_id}/test")
        assert res_test.status_code == 200
        test_out = res_test.json()
        assert test_out["category"] == "project_management"
        assert test_out["provider"] == "jira"

        # 5. Delete Credential
        res_del = await client.delete(f"/api/v1/integrations/credentials/{cred_id}")
        assert res_del.status_code == 204

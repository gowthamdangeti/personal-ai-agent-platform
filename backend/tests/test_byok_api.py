import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.main import app
from app.core.config import settings
from app.services.encryption import encryption_service
from app.services.llm_resolver import resolve_llm_config
from app.models.credential import ProviderCredential

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_settings_api_keys_crud_and_ssrf():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Get providers catalog
        catalog_res = await ac.get("/api/v1/settings/providers/catalog")
        assert catalog_res.status_code == 200
        catalog = catalog_res.json()
        assert len(catalog) >= 7
        provider_ids = [p["id"] for p in catalog]
        assert "openai" in provider_ids
        assert "gemini" in provider_ids
        assert "groq" in provider_ids
        assert "deepseek" in provider_ids
        assert "openrouter" in provider_ids
        assert "anthropic" in provider_ids
        assert "custom" in provider_ids

        # 2. Test unsaved key with SSRF URL on custom provider
        ssrf_test = await ac.post(
            "/api/v1/settings/api-keys/test",
            json={
                "provider": "custom",
                "api_key": "some-key",
                "base_url": "http://127.0.0.1:9000/v1",
            },
        )
        assert ssrf_test.status_code == 200
        data = ssrf_test.json()
        assert data["success"] is False
        assert "SSRF" in data["message"] or "prohibited" in data["message"] or "restricted" in data["message"]

        # 3. Create a provider credential
        create_res = await ac.post(
            "/api/v1/settings/api-keys",
            json={
                "provider": "groq",
                "name": "Groq Fast Inference",
                "api_key": "gsk_test1234567890abcdef",
                "model_name": "llama-3.3-70b-versatile",
                "is_default": True,
            },
        )
        assert create_res.status_code == 201
        created = create_res.json()
        cred_id = created["id"]
        assert created["provider"] == "groq"
        assert created["masked_api_key"].startswith("gsk_")
        assert created["masked_api_key"].endswith("cdef")
        assert "test1234567890" not in created["masked_api_key"]
        assert created["is_default"] is True

        # 4. List keys
        list_res = await ac.get("/api/v1/settings/api-keys")
        assert list_res.status_code == 200
        keys = list_res.json()
        matching = [k for k in keys if k["id"] == cred_id]
        assert len(matching) == 1
        assert "test1234567890" not in str(list_res.content)

        # 5. Create a second credential and test setting default
        create2_res = await ac.post(
            "/api/v1/settings/api-keys",
            json={
                "provider": "deepseek",
                "name": "DeepSeek Coder",
                "api_key": "sk-deepseek-test-key-5678",
                "model_name": "deepseek-chat",
                "is_default": False,
            },
        )
        assert create2_res.status_code == 201
        cred2_id = create2_res.json()["id"]

        # Set second credential as default
        set_def_res = await ac.put(
            "/api/v1/settings/default-provider",
            json={"provider_id": cred2_id},
        )
        assert set_def_res.status_code == 200
        assert set_def_res.json()["is_default"] is True

        # Check that first credential is no longer default
        list_after_def = (await ac.get("/api/v1/settings/api-keys")).json()
        c1 = next(c for c in list_after_def if c["id"] == cred_id)
        assert c1["is_default"] is False

        # 6. Test saved key endpoint
        test_saved_res = await ac.post(f"/api/v1/settings/api-keys/{cred_id}/test")
        assert test_saved_res.status_code == 200
        test_saved_data = test_saved_res.json()
        assert test_saved_data["provider"] == "groq"
        assert test_saved_data["success"] is False

        # 7. Update key
        update_res = await ac.put(
            f"/api/v1/settings/api-keys/{cred_id}",
            json={
                "model_name": "mixtral-8x7b-32768",
                "name": "Updated Groq Name",
            },
        )
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["model_name"] == "mixtral-8x7b-32768"
        assert updated["name"] == "Updated Groq Name"

        # 8. Delete keys
        del_res = await ac.delete(f"/api/v1/settings/api-keys/{cred_id}")
        assert del_res.status_code == 204
        del2_res = await ac.delete(f"/api/v1/settings/api-keys/{cred2_id}")
        assert del2_res.status_code == 204

        # Verify deletion
        list_after = await ac.get("/api/v1/settings/api-keys")
        assert not any(k["id"] in (cred_id, cred2_id) for k in list_after.json())


@pytest.mark.asyncio
async def test_settings_validation_errors():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Invalid provider
        bad_prov = await ac.post(
            "/api/v1/settings/api-keys",
            json={
                "provider": "unknown_provider_xyz",
                "api_key": "some-key",
            },
        )
        assert bad_prov.status_code == 422

        # Custom provider missing base_url
        bad_custom = await ac.post(
            "/api/v1/settings/api-keys",
            json={
                "provider": "custom",
                "api_key": "some-key",
            },
        )
        assert bad_custom.status_code == 422
        assert "requires a base_url" in bad_custom.json()["detail"]

        # Blank API key
        blank_key = await ac.post(
            "/api/v1/settings/api-keys",
            json={
                "provider": "openai",
                "api_key": "   ",
            },
        )
        assert blank_key.status_code == 422


@pytest.mark.asyncio
async def test_llm_resolver_hierarchy():
    async with TestSessionLocal() as db:
        # 1. With no DB keys and no env key, should return None or env fallback
        resolved = await resolve_llm_config(db)
        assert resolved is None or resolved.provider == "openai_env"

        # 2. Add an active BYOK credential to DB
        key = "sk-ant-test-credential-123456"
        cred = ProviderCredential(
            provider="anthropic",
            name="Test Anthropic",
            encrypted_api_key=encryption_service.encrypt(key),
            model_name="claude-3-5-sonnet-latest",
            is_active=True,
            is_default=True,
        )
        db.add(cred)
        await db.commit()
        await db.refresh(cred)

        try:
            # Should resolve the default credential
            res_default = await resolve_llm_config(db)
            assert res_default is not None
            assert res_default.provider == "anthropic"
            assert res_default.api_key == key
            assert res_default.model == "claude-3-5-sonnet-latest"
            assert res_default.credential_id == cred.id

            # Payload model override
            res_override = await resolve_llm_config(db, payload={"model": "claude-3-5-haiku-latest"})
            assert res_override is not None
            assert res_override.model == "claude-3-5-haiku-latest"
        finally:
            await db.delete(cred)
            await db.commit()

    await test_engine.dispose()

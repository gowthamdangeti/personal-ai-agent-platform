from datetime import datetime, timezone
import logging
from typing import Any
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.agent import Agent
from app.models.credential import AgentCredentialAssignment, ProviderCredential
from app.schemas.integrations import (
    CATEGORIES_METADATA,
    AgentAssignmentRequest,
    AgentAssignmentResponse,
    ConnectionTestRequest,
    ConnectionTestResult,
    CredentialCreateRequest,
    CredentialReadResponse,
    CredentialUpdateRequest,
    IntegrationCatalogItem,
)
from app.services.encryption import encryption_service
from app.services.integrations.catalog import (
    INTEGRATION_CATALOG,
    get_catalog_by_category,
    get_catalog_item,
)
from app.services.integrations.validator import integration_validator
from app.services.ssrf import validate_safe_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _to_read_response(
    cred: ProviderCredential,
    assigned_agents_map: dict[uuid.UUID, list[Agent]] | None = None,
) -> CredentialReadResponse:
    masked_secrets: dict[str, str] = {}
    masked_api_key: str | None = None

    # 1. Mask secrets from JSON payload
    if cred.encrypted_secret_payload:
        try:
            decrypted_dict = encryption_service.decrypt_payload(cred.encrypted_secret_payload)
            for k, val in decrypted_dict.items():
                if k in ("connection_string", "uri"):
                    masked_secrets[k] = encryption_service.mask_secret(str(val), "connection_string")
                else:
                    masked_secrets[k] = encryption_service.mask_key(str(val))
        except Exception:
            masked_secrets = {"secret": "****(encrypted)"}

    # 2. Mask legacy api key
    if cred.encrypted_api_key:
        try:
            dec = encryption_service.decrypt(cred.encrypted_api_key)
            masked_api_key = encryption_service.mask_key(dec)
            if not masked_secrets.get("api_key"):
                masked_secrets["api_key"] = masked_api_key
        except Exception:
            masked_api_key = "sk-****(encrypted)"

    agents_list = []
    agent_ids = []
    if assigned_agents_map and cred.id in assigned_agents_map:
        for a in assigned_agents_map[cred.id]:
            agent_ids.append(a.id)
            agents_list.append(a.name)

    return CredentialReadResponse(
        id=cred.id,
        category=cred.category,
        provider=cred.provider,
        name=cred.name,
        masked_api_key=masked_api_key,
        masked_secrets=masked_secrets,
        config=cred.non_secret_config or {},
        model_name=cred.model_name,
        base_url=cred.base_url,
        scopes=cred.scopes or [],
        is_active=cred.is_active,
        is_default=cred.is_default,
        connection_status=cred.connection_status or "untested",
        last_tested_at=cred.last_tested_at,
        usage_count=cred.usage_count or 0,
        last_used_at=cred.last_used_at,
        assigned_agent_ids=agent_ids,
        assigned_agent_names=agents_list,
        created_at=cred.created_at,
        updated_at=cred.updated_at,
    )


# ----------------------------------------------------
# Catalog Endpoints
# ----------------------------------------------------

@router.get("/categories")
async def list_categories():
    """Returns the list of 8 supported integration categories."""
    return CATEGORIES_METADATA


@router.get("/catalog", response_model=list[IntegrationCatalogItem])
async def list_catalog(category: str | None = Query(default=None)):
    """Returns integration catalog items, optionally filtered by category."""
    if category:
        return get_catalog_by_category(category)
    return INTEGRATION_CATALOG


@router.get("/catalog/{provider_id}", response_model=IntegrationCatalogItem)
async def get_catalog_entry(provider_id: str):
    """Returns metadata for a specific catalog item."""
    item = get_catalog_item(provider_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Integration '{provider_id}' not found in catalog")
    return item


# ----------------------------------------------------
# Credential Vault CRUD Endpoints
# ----------------------------------------------------

@router.get("/credentials", response_model=list[CredentialReadResponse])
async def list_credentials(
    category: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Lists all stored credentials in the centralized BYOK vault with masked secrets."""
    stmt = select(ProviderCredential)
    if category:
        stmt = stmt.where(ProviderCredential.category == category.lower().strip())
    if provider:
        stmt = stmt.where(ProviderCredential.provider == provider.lower().strip())
    if is_active is not None:
        stmt = stmt.where(ProviderCredential.is_active == is_active)

    stmt = stmt.order_by(
        ProviderCredential.category.asc(),
        ProviderCredential.is_default.desc(),
        ProviderCredential.created_at.desc(),
    )
    records = (await db.scalars(stmt)).all()

    # Load agent assignments
    assignment_stmt = select(AgentCredentialAssignment, Agent).join(Agent, Agent.id == AgentCredentialAssignment.agent_id)
    assignments = (await db.execute(assignment_stmt)).all()
    assigned_map: dict[uuid.UUID, list[Agent]] = {}
    for assign, ag in assignments:
        assigned_map.setdefault(assign.credential_id, []).append(ag)

    return [_to_read_response(r, assigned_map) for r in records]


@router.post("/credentials", response_model=CredentialReadResponse, status_code=status.HTTP_201_CREATED)
async def create_credential(
    payload: CredentialCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Stores a new encrypted integration credential in the BYOK vault."""
    prov = payload.provider.lower().strip()
    cat = payload.category.lower().strip()

    # Consolidate secrets
    secrets_to_encrypt = dict(payload.secrets or {})
    if payload.api_key and not secrets_to_encrypt.get("api_key"):
        secrets_to_encrypt["api_key"] = payload.api_key.strip()

    # Validate safe URLs if present
    base_url = payload.base_url.strip() if payload.base_url else None
    if base_url:
        try:
            base_url = validate_safe_url(base_url)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Security error with base_url: {exc}",
            ) from exc

    config = dict(payload.config or {})
    for url_key in ("site_url", "base_url"):
        if config.get(url_key):
            try:
                config[url_key] = validate_safe_url(config[url_key])
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Security error with {url_key}: {exc}",
                ) from exc

    # Encrypt secrets payload
    encrypted_payload = encryption_service.encrypt_payload(secrets_to_encrypt) if secrets_to_encrypt else None
    legacy_api_key = encryption_service.encrypt(secrets_to_encrypt["api_key"]) if "api_key" in secrets_to_encrypt else None

    # Handle default status per category
    existing_in_category = len(
        (await db.scalars(select(ProviderCredential.id).where(ProviderCredential.category == cat))).all()
    )
    is_default = payload.is_default or existing_in_category == 0
    if is_default:
        await db.execute(
            update(ProviderCredential)
            .where(ProviderCredential.category == cat)
            .values(is_default=False)
        )

    model_name = payload.model_name or config.get("model_name") or ""

    cred = ProviderCredential(
        category=cat,
        provider=prov,
        name=payload.name.strip() if payload.name else None,
        encrypted_api_key=legacy_api_key,
        encrypted_secret_payload=encrypted_payload,
        non_secret_config=config,
        scopes=payload.scopes or [],
        model_name=model_name,
        base_url=base_url,
        is_active=True,
        is_default=is_default,
        connection_status="untested",
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)

    # Assign to requested agents
    assigned_agents_list: list[Agent] = []
    if payload.assigned_agent_ids:
        for aid in payload.assigned_agent_ids:
            ag = await db.get(Agent, aid)
            if ag:
                assignment = AgentCredentialAssignment(agent_id=ag.id, credential_id=cred.id)
                db.add(assignment)
                assigned_agents_list.append(ag)
        await db.commit()

    return _to_read_response(cred, {cred.id: assigned_agents_list})


@router.get("/credentials/{credential_id}", response_model=CredentialReadResponse)
async def get_credential(
    credential_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details and masked secrets for a specific credential."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    assign_stmt = select(Agent).join(AgentCredentialAssignment, AgentCredentialAssignment.agent_id == Agent.id).where(AgentCredentialAssignment.credential_id == cred.id)
    assigned_agents = (await db.scalars(assign_stmt)).all()

    return _to_read_response(cred, {cred.id: list(assigned_agents)})


@router.put("/credentials/{credential_id}", response_model=CredentialReadResponse)
async def update_credential(
    credential_id: uuid.UUID,
    payload: CredentialUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update settings, rotate secrets, or modify agent assignments for a credential."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    if payload.name is not None:
        cred.name = payload.name.strip() if payload.name else None

    # Handle secret rotation
    if payload.secrets is not None or payload.api_key is not None:
        existing_secrets = {}
        if cred.encrypted_secret_payload:
            try:
                existing_secrets = encryption_service.decrypt_payload(cred.encrypted_secret_payload)
            except Exception:
                existing_secrets = {}

        if payload.secrets is not None:
            existing_secrets.update(payload.secrets)
        if payload.api_key is not None:
            existing_secrets["api_key"] = payload.api_key.strip()

        cred.encrypted_secret_payload = encryption_service.encrypt_payload(existing_secrets)
        if "api_key" in existing_secrets:
            cred.encrypted_api_key = encryption_service.encrypt(existing_secrets["api_key"])

    if payload.config is not None:
        cleaned_config = dict(payload.config)
        for url_key in ("site_url", "base_url"):
            if cleaned_config.get(url_key):
                cleaned_config[url_key] = validate_safe_url(cleaned_config[url_key])
        cred.non_secret_config = cleaned_config

    if payload.model_name is not None:
        cred.model_name = payload.model_name.strip()

    if payload.base_url is not None:
        cleaned_url = payload.base_url.strip() if payload.base_url else None
        if cleaned_url:
            cleaned_url = validate_safe_url(cleaned_url)
        cred.base_url = cleaned_url

    if payload.scopes is not None:
        cred.scopes = payload.scopes

    if payload.is_active is not None:
        cred.is_active = payload.is_active

    if payload.is_default is True:
        await db.execute(
            update(ProviderCredential)
            .where(ProviderCredential.category == cred.category)
            .values(is_default=False)
        )
        cred.is_default = True

    # Update agent assignments if explicitly provided
    if payload.assigned_agent_ids is not None:
        await db.execute(
            delete(AgentCredentialAssignment).where(AgentCredentialAssignment.credential_id == cred.id)
        )
        for aid in payload.assigned_agent_ids:
            ag = await db.get(Agent, aid)
            if ag:
                db.add(AgentCredentialAssignment(agent_id=ag.id, credential_id=cred.id))

    await db.commit()
    await db.refresh(cred)

    assign_stmt = select(Agent).join(AgentCredentialAssignment, AgentCredentialAssignment.agent_id == Agent.id).where(AgentCredentialAssignment.credential_id == cred.id)
    assigned_agents = (await db.scalars(assign_stmt)).all()

    return _to_read_response(cred, {cred.id: list(assigned_agents)})


@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a credential from the vault."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    category = cred.category
    was_default = cred.is_default

    await db.delete(cred)
    await db.commit()

    # Re-elect default if necessary
    if was_default:
        next_default = await db.scalar(
            select(ProviderCredential)
            .where(ProviderCredential.category == category, ProviderCredential.is_active.is_(True))
            .order_by(ProviderCredential.created_at.desc())
        )
        if next_default:
            next_default.is_default = True
            await db.commit()

    return None


@router.put("/credentials/{credential_id}/default", response_model=CredentialReadResponse)
async def set_default_credential(
    credential_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Sets the credential as the system default for its category."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    if not cred.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set an inactive credential as default. Please activate it first.",
        )

    await db.execute(
        update(ProviderCredential)
        .where(ProviderCredential.category == cred.category)
        .values(is_default=False)
    )
    cred.is_default = True
    await db.commit()
    await db.refresh(cred)

    assign_stmt = select(Agent).join(AgentCredentialAssignment, AgentCredentialAssignment.agent_id == Agent.id).where(AgentCredentialAssignment.credential_id == cred.id)
    assigned_agents = (await db.scalars(assign_stmt)).all()

    return _to_read_response(cred, {cred.id: list(assigned_agents)})


# ----------------------------------------------------
# Connection Testing Endpoints
# ----------------------------------------------------

@router.post("/credentials/test", response_model=ConnectionTestResult)
async def test_unsaved_connection(payload: ConnectionTestRequest):
    """Tests connection parameters without saving anything to the database."""
    secrets = dict(payload.secrets or {})
    if payload.api_key and not secrets.get("api_key"):
        secrets["api_key"] = payload.api_key

    return await integration_validator.test_connection(
        category=payload.category,
        provider=payload.provider,
        secrets=secrets,
        config=payload.config or {},
        api_key=payload.api_key,
        model_name=payload.model_name,
        base_url=payload.base_url,
    )


@router.post("/credentials/{credential_id}/test", response_model=ConnectionTestResult)
async def test_saved_credential(
    credential_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Tests an existing credential by decrypting it in-memory, updating its health status."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    secrets = {}
    if cred.encrypted_secret_payload:
        try:
            secrets = encryption_service.decrypt_payload(cred.encrypted_secret_payload)
        except Exception as exc:
            return ConnectionTestResult(
                success=False,
                message=f"Failed to decrypt credentials payload: {exc}",
                category=cred.category,
                provider=cred.provider,
            )

    if cred.encrypted_api_key and not secrets.get("api_key"):
        try:
            secrets["api_key"] = encryption_service.decrypt(cred.encrypted_api_key)
        except Exception:
            pass

    result = await integration_validator.test_connection(
        category=cred.category,
        provider=cred.provider,
        secrets=secrets,
        config=cred.non_secret_config or {},
        api_key=secrets.get("api_key"),
        model_name=cred.model_name,
        base_url=cred.base_url,
    )

    # Update database record with test result
    now = datetime.now(timezone.utc)
    cred.last_tested_at = now
    cred.connection_status = "healthy" if result.success else "failed"
    await db.commit()

    return result


# ----------------------------------------------------
# Agent Assignment Endpoints
# ----------------------------------------------------

@router.get("/agents/{agent_id}/credentials", response_model=list[CredentialReadResponse])
async def list_agent_credentials(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Lists all credentials explicitly assigned to a specific agent."""
    stmt = (
        select(ProviderCredential)
        .join(AgentCredentialAssignment, AgentCredentialAssignment.credential_id == ProviderCredential.id)
        .where(AgentCredentialAssignment.agent_id == agent_id)
        .order_by(ProviderCredential.category.asc(), ProviderCredential.provider.asc())
    )
    records = (await db.scalars(stmt)).all()
    ag = await db.get(Agent, agent_id)
    ag_map = {r.id: [ag] for r in records} if ag else {}
    return [_to_read_response(r, ag_map) for r in records]


@router.post("/agents/{agent_id}/credentials", response_model=AgentAssignmentResponse)
async def assign_agent_credentials(
    agent_id: uuid.UUID,
    payload: AgentAssignmentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Replaces or sets the assigned credentials for an agent."""
    ag = await db.get(Agent, agent_id)
    if not ag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Clear existing assignments for this agent
    await db.execute(
        delete(AgentCredentialAssignment).where(AgentCredentialAssignment.agent_id == agent_id)
    )

    assigned: list[uuid.UUID] = []
    for cid in payload.agent_ids:
        c = await db.get(ProviderCredential, cid)
        if c:
            db.add(AgentCredentialAssignment(agent_id=ag.id, credential_id=c.id))
            assigned.append(c.id)

    await db.commit()
    return AgentAssignmentResponse(credential_id=agent_id, assigned_agent_ids=assigned)


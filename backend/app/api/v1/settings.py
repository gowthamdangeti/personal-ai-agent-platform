import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.credential import ProviderCredential
from app.schemas.credential import (
    DEFAULT_PROVIDER_MODELS,
    SUPPORTED_PROVIDERS,
    ProviderCatalogItem,
    ProviderCredentialCreate,
    ProviderCredentialRead,
    ProviderCredentialUpdate,
    ProviderTestRequest,
    ProviderTestResult,
    SetDefaultProviderRequest,
)
from app.services.encryption import encryption_service
from app.services.provider_validator import PROVIDER_CATALOG, provider_validator
from app.services.ssrf import validate_safe_url

router = APIRouter(prefix="/settings", tags=["settings"])


def _to_read_schema(cred: ProviderCredential) -> ProviderCredentialRead:
    try:
        decrypted = encryption_service.decrypt(cred.encrypted_api_key)
        masked = encryption_service.mask_key(decrypted)
    except Exception:
        masked = "sk-****(encrypted)"

    return ProviderCredentialRead(
        id=cred.id,
        provider=cred.provider,
        name=cred.name,
        masked_api_key=masked,
        model_name=cred.model_name,
        base_url=cred.base_url,
        is_active=cred.is_active,
        is_default=cred.is_default,
        created_at=cred.created_at,
        updated_at=cred.updated_at,
    )


@router.get("/providers/catalog", response_model=list[ProviderCatalogItem])
async def get_provider_catalog():
    """Returns the catalog of all supported providers and their default configurations."""
    return PROVIDER_CATALOG


@router.get("/api-keys", response_model=list[ProviderCredentialRead])
async def list_api_keys(db: AsyncSession = Depends(get_db)):
    """List all saved provider credentials with masked API keys."""
    statement = select(ProviderCredential).order_by(
        ProviderCredential.is_default.desc(),
        ProviderCredential.created_at.desc(),
    )
    records = (await db.scalars(statement)).all()
    return [_to_read_schema(rec) for rec in records]


@router.post("/api-keys", response_model=ProviderCredentialRead, status_code=status.HTTP_201_CREATED)
async def create_api_key(payload: ProviderCredentialCreate, db: AsyncSession = Depends(get_db)):
    """Encrypt and store a new provider API key."""
    provider = payload.provider.lower().strip()
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported provider '{payload.provider}'. Supported: {SUPPORTED_PROVIDERS}",
        )

    base_url = payload.base_url.strip() if payload.base_url else None
    if provider == "custom":
        if not base_url:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Custom provider requires a base_url (e.g. https://api.together.xyz/v1)",
            )
        try:
            base_url = validate_safe_url(base_url)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Security error with base_url: {exc}",
            ) from exc

    raw_key = payload.api_key.strip()
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="API key cannot be blank",
        )

    model_name = payload.model_name.strip() or DEFAULT_PROVIDER_MODELS.get(provider, "default")
    encrypted_token = encryption_service.encrypt(raw_key)

    # Check if there are existing credentials; if this is the first one or requested as default, make it default
    existing_count = len((await db.scalars(select(ProviderCredential.id))).all())
    is_default = payload.is_default or existing_count == 0

    if is_default:
        await db.execute(update(ProviderCredential).values(is_default=False))

    cred = ProviderCredential(
        provider=provider,
        name=payload.name.strip() if payload.name else None,
        encrypted_api_key=encrypted_token,
        model_name=model_name,
        base_url=base_url,
        is_active=True,
        is_default=is_default,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return _to_read_schema(cred)


@router.put("/api-keys/{credential_id}", response_model=ProviderCredentialRead)
async def update_api_key(
    credential_id: uuid.UUID,
    payload: ProviderCredentialUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a provider credential's configuration or rotate its API key."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    if payload.name is not None:
        cred.name = payload.name.strip() if payload.name else None

    if payload.api_key is not None:
        raw_key = payload.api_key.strip()
        if raw_key:
            cred.encrypted_api_key = encryption_service.encrypt(raw_key)

    if payload.model_name is not None:
        model = payload.model_name.strip()
        if model:
            cred.model_name = model

    if payload.base_url is not None:
        cleaned_url = payload.base_url.strip() if payload.base_url else None
        if cleaned_url and cred.provider == "custom":
            try:
                cleaned_url = validate_safe_url(cleaned_url)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Security error with base_url: {exc}",
                ) from exc
        cred.base_url = cleaned_url

    if payload.is_active is not None:
        cred.is_active = payload.is_active

    if payload.is_default is True:
        await db.execute(update(ProviderCredential).values(is_default=False))
        cred.is_default = True

    await db.commit()
    await db.refresh(cred)
    return _to_read_schema(cred)


@router.delete("/api-keys/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(credential_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a provider credential permanently."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    was_default = cred.is_default
    await db.delete(cred)
    await db.commit()

    # If the deleted credential was default, pick another active one as default if available
    if was_default:
        next_cred = await db.scalar(
            select(ProviderCredential)
            .where(ProviderCredential.is_active.is_(True))
            .order_by(ProviderCredential.created_at.desc())
        )
        if next_cred:
            next_cred.is_default = True
            await db.commit()

    return None


@router.post("/api-keys/test", response_model=ProviderTestResult)
async def test_unsaved_api_key(payload: ProviderTestRequest):
    """Test provider connection using an unsaved API key without storing it in the database."""
    if not payload.api_key or not payload.api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="API key is required to test connection",
        )
    return await provider_validator.test_connection(
        provider=payload.provider,
        api_key=payload.api_key.strip(),
        model_name=payload.model_name,
        base_url=payload.base_url,
    )


@router.post("/api-keys/{credential_id}/test", response_model=ProviderTestResult)
async def test_saved_api_key(credential_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Test connection for a stored provider credential by decrypting it in-memory."""
    cred = await db.get(ProviderCredential, credential_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    try:
        decrypted_key = encryption_service.decrypt(cred.encrypted_api_key)
    except Exception as exc:
        return ProviderTestResult(
            success=False,
            message=f"Failed to decrypt stored API key: {exc}",
            provider=cred.provider,
            model=cred.model_name,
        )

    return await provider_validator.test_connection(
        provider=cred.provider,
        api_key=decrypted_key,
        model_name=cred.model_name,
        base_url=cred.base_url,
    )


@router.put("/default-provider", response_model=ProviderCredentialRead)
async def set_default_provider(
    payload: SetDefaultProviderRequest, db: AsyncSession = Depends(get_db)
):
    """Set the specified credential as the system default provider."""
    cred = await db.get(ProviderCredential, payload.provider_id)
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    if not cred.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot set an inactive provider as default. Please activate it first.",
        )

    await db.execute(update(ProviderCredential).values(is_default=False))
    cred.is_default = True
    await db.commit()
    await db.refresh(cred)
    return _to_read_schema(cred)


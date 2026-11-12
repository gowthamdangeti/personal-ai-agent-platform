import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class ProviderCredential(Base):
    """
    Centralized encrypted vault model supporting all 8 integration categories:
    1. llm
    2. embedding
    3. research
    4. project_management
    5. developer
    6. monitoring
    7. database
    8. custom
    """
    __tablename__ = "provider_credentials"
    __table_args__ = (
        Index("ix_provider_credentials_category", "category"),
        Index("ix_provider_credentials_provider", "provider"),
        Index("ix_provider_credentials_is_default", "is_default"),
        Index("ix_provider_credentials_is_active", "is_active"),
        Index("ix_provider_credentials_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True, default="default")
    organization_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Category and provider identifier
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="llm")
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Legacy field for simple API keys (maintained for backward compatibility)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Encrypted JSON payload holding any sensitive keys/passwords/tokens
    encrypted_secret_payload: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Non-sensitive configuration (urls, usernames, ports, ssl, timeouts, etc.)
    non_secret_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Scopes / granted permissions
    scopes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Optional model name and base URL (common for LLMs and Custom Gateways)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True, default="")
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Status and tracking
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    connection_status: Mapped[str] = mapped_column(String(30), nullable=False, default="untested")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Agent assignments
    assigned_agents = relationship("AgentCredentialAssignment", back_populates="credential", cascade="all, delete-orphan")


class AgentCredentialAssignment(Base):
    """
    Explicit authorization link mapping an agent to an approved integration credential.
    Agents can only consume credentials explicitly assigned to them or declared system-wide defaults.
    """
    __tablename__ = "agent_credential_assignments"
    __table_args__ = (
        UniqueConstraint("agent_id", "credential_id", name="uq_agent_credential"),
        Index("ix_agent_credential_assignments_agent", "agent_id"),
        Index("ix_agent_credential_assignments_credential", "credential_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    credential_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("provider_credentials.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    credential = relationship("ProviderCredential", back_populates="assigned_agents")

"""Add unified credential vault and agent credential assignments.

Revision ID: 0004_unified_credential_vault
Revises: 0003_add_domain_agents_tables
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_unified_credential_vault"
down_revision = "0003_add_domain_agents_tables"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Update provider_credentials columns
    op.alter_column("provider_credentials", "encrypted_api_key", nullable=True)
    op.alter_column("provider_credentials", "model_name", nullable=True)

    op.add_column(
        "provider_credentials",
        sa.Column("category", sa.String(50), nullable=False, server_default="llm"),
    )
    op.create_index("ix_provider_credentials_category", "provider_credentials", ["category"])

    op.add_column(
        "provider_credentials",
        sa.Column("encrypted_secret_payload", sa.Text(), nullable=True),
    )
    op.add_column(
        "provider_credentials",
        sa.Column("non_secret_config", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )
    op.add_column(
        "provider_credentials",
        sa.Column("scopes", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "provider_credentials",
        sa.Column("connection_status", sa.String(30), nullable=False, server_default="untested"),
    )
    op.add_column(
        "provider_credentials",
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "provider_credentials",
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "provider_credentials",
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2. Create agent_credential_assignments table
    op.create_table(
        "agent_credential_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("credential_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("provider_credentials.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("agent_id", "credential_id", name="uq_agent_credential"),
    )
    op.create_index("ix_agent_credential_assignments_agent", "agent_credential_assignments", ["agent_id"])
    op.create_index("ix_agent_credential_assignments_credential", "agent_credential_assignments", ["credential_id"])


def downgrade():
    op.drop_index("ix_agent_credential_assignments_credential", table_name="agent_credential_assignments")
    op.drop_index("ix_agent_credential_assignments_agent", table_name="agent_credential_assignments")
    op.drop_table("agent_credential_assignments")

    op.drop_column("provider_credentials", "last_used_at")
    op.drop_column("provider_credentials", "usage_count")
    op.drop_column("provider_credentials", "last_tested_at")
    op.drop_column("provider_credentials", "connection_status")
    op.drop_column("provider_credentials", "scopes")
    op.drop_column("provider_credentials", "non_secret_config")
    op.drop_column("provider_credentials", "encrypted_secret_payload")
    op.drop_index("ix_provider_credentials_category", table_name="provider_credentials")
    op.drop_column("provider_credentials", "category")

    op.alter_column("provider_credentials", "model_name", nullable=False)
    op.alter_column("provider_credentials", "encrypted_api_key", nullable=False)


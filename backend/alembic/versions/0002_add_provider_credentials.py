"""Add provider credentials table for BYOK.

Revision ID: 0002_add_provider_credentials
Revises: 0001_initial
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_add_provider_credentials"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "provider_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(100), nullable=True, server_default="default"),
        sa.Column("organization_id", sa.String(100), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=True),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("base_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_provider_credentials_provider", "provider_credentials", ["provider"])
    op.create_index("ix_provider_credentials_is_default", "provider_credentials", ["is_default"])
    op.create_index("ix_provider_credentials_is_active", "provider_credentials", ["is_active"])
    op.create_index("ix_provider_credentials_user_id", "provider_credentials", ["user_id"])


def downgrade():
    op.drop_index("ix_provider_credentials_user_id", table_name="provider_credentials")
    op.drop_index("ix_provider_credentials_is_active", table_name="provider_credentials")
    op.drop_index("ix_provider_credentials_is_default", table_name="provider_credentials")
    op.drop_index("ix_provider_credentials_provider", table_name="provider_credentials")
    op.drop_table("provider_credentials")


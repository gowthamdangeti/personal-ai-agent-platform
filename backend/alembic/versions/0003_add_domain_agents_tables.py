"""Add domain agents tables.

Revision ID: 0003_add_domain_agents_tables
Revises: 0002_add_provider_credentials
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_add_domain_agents_tables"
down_revision = "0002_add_provider_credentials"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Agent Step Trace
    op.create_table(
        "agent_step_traces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("step_type", sa.String(50), nullable=False),
        sa.Column("tool_name", sa.String(100), nullable=True),
        sa.Column("tool_input", sa.JSON(), nullable=True),
        sa.Column("tool_output", sa.JSON(), nullable=True),
        sa.Column("thought_content", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agent_step_traces_run_id", "agent_step_traces", ["run_id"])

    # 2. HITL Approval Requests
    op.create_table(
        "hitl_approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("action_payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), server_default="pending", nullable=False),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_hitl_approval_requests_run_id", "hitl_approval_requests", ["run_id"])
    op.create_index("ix_hitl_approval_requests_status", "hitl_approval_requests", ["status"])

    # 3. Extraction Records
    op.create_table(
        "extraction_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("schema_name", sa.String(100), nullable=False),
        sa.Column("extracted_data", sa.JSON(), nullable=False),
        sa.Column("confidence_scores", sa.JSON(), nullable=False),
        sa.Column("validation_status", sa.String(30), server_default="valid", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_extraction_records_document_id", "extraction_records", ["document_id"])

    # 4. Research Projects
    op.create_table(
        "research_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("depth", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(30), server_default="in_progress", nullable=False),
        sa.Column("final_report_md", sa.Text(), nullable=True),
        sa.Column("sources_summary", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 5. Meeting Sessions & Action Items
    op.create_table(
        "meeting_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("meeting_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("transcript_object_key", sa.String(512), nullable=True),
        sa.Column("executive_summary", sa.Text(), nullable=True),
        sa.Column("decisions_log", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "action_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meeting_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_description", sa.Text(), nullable=False),
        sa.Column("assignee_name", sa.String(120), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), server_default="open", nullable=False),
        sa.Column("external_ticket_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_action_items_meeting_id", "action_items", ["meeting_id"])

    # 6. Test Suites
    op.create_table(
        "test_suites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("framework", sa.String(50), nullable=False),
        sa.Column("target_service", sa.String(100), nullable=False),
        sa.Column("spec_code", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), server_default="draft", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 7. Procurement & Finance
    op.create_table(
        "procurement_vendors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("tax_id", sa.String(50), nullable=True),
        sa.Column("compliance_score", sa.Integer(), server_default="100", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("po_number", sa.String(60), unique=True, nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("procurement_vendors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD", nullable=False),
        sa.Column("status", sa.String(30), server_default="draft", nullable=False),
        sa.Column("line_items", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "finance_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_number", sa.String(100), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("procurement_vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("matched_po_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("status", sa.String(30), server_default="received", nullable=False),
        sa.Column("raw_document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_finance_invoices_invoice_number", "finance_invoices", ["invoice_number"])

    op.create_table(
        "finance_reconciliation_audits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("finance_invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("po_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("variance_amount", sa.Numeric(14, 2), server_default="0.0", nullable=False),
        sa.Column("discrepancy_details", sa.JSON(), nullable=True),
        sa.Column("audit_verdict", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 8. IT Operations
    op.create_table(
        "itops_incidents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("severity", sa.String(10), server_default="P3", nullable=False),
        sa.Column("service_name", sa.String(100), nullable=False),
        sa.Column("root_cause_analysis", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), server_default="investigating", nullable=False),
        sa.Column("diagnostics_log", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 9. Workflows
    op.create_table(
        "workflow_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("dag_schema", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "workflow_executions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(30), server_default="running", nullable=False),
        sa.Column("context_data", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_workflow_executions_workflow_id", "workflow_executions", ["workflow_id"])

    # 10. Data Connections
    op.create_table(
        "data_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("engine_type", sa.String(30), server_default="postgresql", nullable=False),
        sa.Column("connection_uri_encrypted", sa.Text(), nullable=False),
        sa.Column("cached_schema_catalog", sa.JSON(), nullable=True),
        sa.Column("is_read_only", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("data_connections")
    op.drop_table("workflow_executions")
    op.drop_table("workflow_definitions")
    op.drop_table("itops_incidents")
    op.drop_table("finance_reconciliation_audits")
    op.drop_table("finance_invoices")
    op.drop_table("purchase_orders")
    op.drop_table("procurement_vendors")
    op.drop_table("test_suites")
    op.drop_table("action_items")
    op.drop_table("meeting_sessions")
    op.drop_table("research_projects")
    op.drop_table("extraction_records")
    op.drop_table("hitl_approval_requests")
    op.drop_table("agent_step_traces")


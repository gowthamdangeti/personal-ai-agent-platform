import uuid
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class AgentRunRequest(BaseModel):
    input_text: str = Field(..., min_length=1, description="Primary prompt or instructions for the agent")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Agent-specific execution parameters")
    run_async: bool = Field(default=False, description="Whether to queue on ARQ worker or execute inline")
    provider_credential_id: uuid.UUID | None = Field(default=None, description="Optional override LLM provider")


class HITLApprovalPayload(BaseModel):
    reviewer_notes: str | None = Field(default=None)
    modified_payload: dict[str, Any] | None = Field(default=None)


class HITLApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    run_id: uuid.UUID
    agent_id: uuid.UUID
    action_type: str
    action_payload: dict[str, Any]
    status: str
    reviewer_notes: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime


class AgentStepTraceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    run_id: uuid.UUID
    step_index: int
    step_type: str
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tool_output: dict[str, Any] | None = None
    thought_content: str | None = None
    duration_ms: int | None = None
    created_at: datetime


class TextToSQLRequest(BaseModel):
    connection_id: uuid.UUID | None = None
    prompt: str = Field(..., examples=["Show top 5 customers by spending over the last quarter"])
    auto_execute: bool = Field(default=True)
    chart_type: Literal["bar", "line", "pie", "scatter", "table"] = "bar"


class StructuredExtractionRequest(BaseModel):
    document_id: uuid.UUID
    schema_name: str = Field(..., examples=["commercial_invoice_v1"])
    target_json_schema: dict[str, Any] | None = None


class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=3)
    depth: int = Field(default=2, ge=1, le=5)
    report_format: Literal["executive_brief", "comprehensive_report"] = "comprehensive_report"


class MeetingProcessRequest(BaseModel):
    title: str = Field(default="Team Sync")
    transcript: str = Field(..., min_length=10)
    meeting_date: datetime | None = None


class QAGenerateRequest(BaseModel):
    target_service: str = Field(..., examples=["billing-service"])
    framework: Literal["pytest", "playwright", "jest"] = "pytest"
    spec_or_diff: str = Field(..., min_length=10)


class ProcurementRFPRequest(BaseModel):
    requirements: str = Field(..., min_length=10)
    vendor_quotes: list[dict[str, Any]] = Field(default_factory=list)


class FinanceReconcileRequest(BaseModel):
    invoice_number: str
    vendor_name: str
    amount: float
    po_number: str | None = None


class ITOpsDiagnoseRequest(BaseModel):
    service_name: str
    error_logs: str
    severity: Literal["P1", "P2", "P3", "P4"] = "P3"


class WorkflowTriggerRequest(BaseModel):
    workflow_id: uuid.UUID
    initial_context: dict[str, Any] = Field(default_factory=dict)


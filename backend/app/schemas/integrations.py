import uuid
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

IntegrationCategory = Literal[
    "llm",
    "embedding",
    "research",
    "project_management",
    "developer",
    "monitoring",
    "database",
    "custom",
]

CATEGORIES_METADATA = [
    {"id": "llm", "name": "AI Providers", "description": "Large language models for reasoning and generation."},
    {"id": "embedding", "name": "Embeddings", "description": "Vector embedding models for semantic retrieval."},
    {"id": "research", "name": "Research & Search", "description": "Web and scientific search synthesis APIs."},
    {"id": "project_management", "name": "Project Management", "description": "Issue tracking and project sync (Jira, Linear)."},
    {"id": "developer", "name": "Developer Integrations", "description": "Code repositories and version control (GitHub)."},
    {"id": "monitoring", "name": "Monitoring & Telemetry", "description": "System metrics and alert monitoring (Prometheus, Grafana)."},
    {"id": "database", "name": "External Databases", "description": "Direct read-only analytics data sources (Postgres, MySQL)."},
    {"id": "custom", "name": "Custom Integrations", "description": "Custom authenticated HTTP REST/Webhook endpoints."},
]


class FieldDefinition(BaseModel):
    name: str
    label: str
    type: Literal["text", "password", "url", "number", "select", "textarea"] = "text"
    required: bool = False
    placeholder: str = ""
    description: str = ""
    options: list[str] = []
    default: Any = None


class IntegrationCatalogItem(BaseModel):
    id: str
    name: str
    category: str
    description: str
    supported_auth_methods: list[str] = ["api_key"]
    secret_fields: list[FieldDefinition] = []
    config_fields: list[FieldDefinition] = []
    default_config: dict[str, Any] = {}
    suggested_models: list[str] = []
    default_model: str | None = None
    default_base_url: str | None = None
    requires_base_url: bool = False


class CredentialCreateRequest(BaseModel):
    category: str = Field(default="llm", description="Category: llm, embedding, research, etc.")
    provider: str = Field(..., description="Provider identifier (e.g. openai, jira, github, tavily, postgres)")
    name: str | None = Field(default=None, max_length=100)
    api_key: str | None = Field(default=None, max_length=1000, description="Plaintext primary API key")
    secrets: dict[str, str] = Field(default_factory=dict, description="Arbitrary sensitive values to be encrypted")
    config: dict[str, Any] = Field(default_factory=dict, description="Non-sensitive configuration")
    model_name: str | None = Field(default=None, max_length=120)
    base_url: str | None = Field(default=None, max_length=500)
    scopes: list[str] = Field(default_factory=list)
    is_default: bool = False
    assigned_agent_ids: list[uuid.UUID] = Field(default_factory=list)


class CredentialUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    api_key: str | None = Field(default=None, max_length=1000)
    secrets: dict[str, str] | None = None
    config: dict[str, Any] | None = None
    model_name: str | None = Field(default=None, max_length=120)
    base_url: str | None = Field(default=None, max_length=500)
    scopes: list[str] | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    assigned_agent_ids: list[uuid.UUID] | None = None


class CredentialReadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: str
    provider: str
    name: str | None
    masked_api_key: str | None
    masked_secrets: dict[str, str] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    model_name: str | None
    base_url: str | None
    scopes: list[str] = Field(default_factory=list)
    is_active: bool
    is_default: bool
    connection_status: str
    last_tested_at: datetime | None
    usage_count: int
    last_used_at: datetime | None
    assigned_agent_ids: list[uuid.UUID] = Field(default_factory=list)
    assigned_agent_names: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ConnectionTestRequest(BaseModel):
    category: str
    provider: str
    secrets: dict[str, str] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    api_key: str | None = None
    model_name: str | None = None
    base_url: str | None = None


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
    category: str
    provider: str
    latency_ms: int | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class AgentAssignmentRequest(BaseModel):
    agent_ids: list[uuid.UUID]


class AgentAssignmentResponse(BaseModel):
    credential_id: uuid.UUID
    assigned_agent_ids: list[uuid.UUID]


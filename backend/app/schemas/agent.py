import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    kind: str = "knowledge"
    description: str | None = None
    config: dict = Field(default_factory=dict)


class AgentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    kind: str
    description: str | None
    config: dict
    created_at: datetime


class AgentRunRequest(BaseModel):
    question: str | None = Field(default=None, min_length=2, max_length=8000)
    document_id: uuid.UUID | None = None
    instructions: str = Field(default="", max_length=4000)
    fields: list[str] = Field(default_factory=list, max_length=30)
    top_k: int = Field(default=5, ge=1, le=12)
    provider: str | None = None
    model: str | None = None
    credential_id: uuid.UUID | None = None


class AgentRunRead(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    question: str
    answer: str | None
    sources: list
    duration_ms: int | None
    created_at: datetime

    @classmethod
    def from_model(cls, run):
        return cls(
            id=run.id, agent_id=run.agent_id, status=run.status,
            question=run.input_text, answer=run.output_text,
            sources=run.sources or [], duration_ms=run.duration_ms,
            created_at=run.created_at,
        )

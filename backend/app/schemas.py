from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class MemoryWriteRequest(BaseModel):
    tenant_id: str
    agent_id: str
    content: str
    source_type: str = Field(default="user")
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    source_id: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryQueryRequest(BaseModel):
    tenant_id: str
    agent_id: str
    query: str
    filters: dict[str, Any] = Field(default_factory=dict)


class TimelineQueryRequest(BaseModel):
    tenant_id: str
    agent_id: str
    limit: int = Field(default=25, ge=1, le=200)


class ObservabilitySummaryResponse(BaseModel):
    tenant_id: str
    agent_id: str
    total_events: int
    active_memories: int
    quarantined_events: int
    avg_trust_score: float
    latest_event_at: Optional[str] = None


class AgentRunRequest(BaseModel):
    tenant_id: str
    agent_id: str
    input: str
    session_id: Optional[str] = None


# SDK Event Ingestion (used by HttpTransport)
class SDKEvent(BaseModel):
    event_id: Optional[str] = None
    agent_id: str = "unknown"
    operation: str = "create"
    memory_key: str = ""
    memory_type: str = "working"
    namespace: str = "default"
    session_id: Optional[str] = None
    llm_call_id: Optional[str] = None
    timestamp: Optional[str] = None
    before_value: Optional[dict] = None
    after_value: Optional[dict] = None
    content_hash: Optional[str] = None
    source_id: Optional[str] = None
    source_version: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    context: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    caused_by: Optional[str] = None


class EventsIngestRequest(BaseModel):
    events: list[SDKEvent]


class CaseCreateRequest(BaseModel):
    trace_id: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    suspected_source_id: Optional[str] = None
    suspected_source_version: Optional[str] = None
    expected_contains: list[str] = Field(default_factory=list)
    forbidden_contains: list[str] = Field(default_factory=list)


class CaseUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    suspected_source_id: Optional[str] = None
    suspected_source_version: Optional[str] = None
    remediation_summary: Optional[str] = None
    remediation_reference: Optional[str] = None
    status: Optional[Literal["open", "investigating", "resolved", "closed"]] = None
    expected_contains: Optional[list[str]] = None
    forbidden_contains: Optional[list[str]] = None


class ReplayCreateRequest(BaseModel):
    variant_label: str = Field(default="replay", min_length=1, max_length=100)
    output: str
    disabled_event_ids: list[str] = Field(default_factory=list)
    model: Optional[str] = None
    prompt_hash: Optional[str] = None
    execution_origin: Literal["manual_import", "external_runner"] = "manual_import"
    run_id: Optional[str] = None
    code_revision: Optional[str] = None
    input_snapshot_hash: Optional[str] = None
    run_metadata: dict[str, Any] = Field(default_factory=dict)

import asyncio
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agents.engine import agent_engine
from app.agents.registry import agent_registry
from app.db.session import get_db
from app.models.agent import Agent, AgentRun
from app.models.domain_agents import AgentStepTrace, HITLApprovalRequest
from app.schemas.agent import AgentCreate, AgentRead, AgentRunRead
from app.schemas.agent_payloads import (
    AgentRunRequest as UnifiedRunRequest,
    AgentStepTraceRead,
    HITLApprovalPayload,
    HITLApprovalResponse,
)
from app.services.llm_resolver import resolve_llm_config

router = APIRouter(tags=["agents"])


def make_slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "agent"
    return base[:100]


# ============================================================================
# 1. Agent Discovery & Listing
# ============================================================================

@router.get("/agents")
async def list_agents(
    db: AsyncSession = Depends(get_db),
    include_metadata: bool = Query(default=True, description="Include registry metadata"),
):
    """List agents in the database, augmented with capability metadata for all 10 kinds."""
    supported = agent_registry.supported_kinds()
    db_agents = list((await db.scalars(
        select(Agent)
        .where(Agent.kind.in_(supported))
        .order_by(Agent.created_at.asc())
    )).all())
    existing_slugs = {a.slug for a in db_agents}

    agent_metadata = {
        "knowledge": {
            "title": "Knowledge Agent",
            "description": "Hybrid RAG semantic retrieval over indexed documents with RRF and citations.",
            "category": "Knowledge & Documents",
            "is_hitl": False,
        },
        "document_processing": {
            "title": "Document Processing Agent",
            "description": "Schema-enforced JSON extraction from PDF, DOCX, and unstructured contracts.",
            "category": "Knowledge & Documents",
            "is_hitl": False,
        },
        "research": {
            "title": "Research Agent",
            "description": "Recursive web synthesis and deep multi-source intelligence reports.",
            "category": "Knowledge & Documents",
            "is_hitl": False,
        },
        "meeting_intelligence": {
            "title": "Meeting Intelligence Agent",
            "description": "Transcript summarization, decision extraction, and Jira action item sync.",
            "category": "Knowledge & Documents",
            "is_hitl": True,
        },
        "qa": {
            "title": "QA Agent",
            "description": "Automated test suite generator (PyTest/Playwright) and sandboxed execution.",
            "category": "Engineering & Operations",
            "is_hitl": False,
        },
        "procurement": {
            "title": "Procurement Agent",
            "description": "Vendor proposal scoring matrix and purchase order generation with HITL gate.",
            "category": "Business & Finance",
            "is_hitl": True,
        },
        "finance": {
            "title": "Finance Agent",
            "description": "3-way invoice-to-PO matching and Z-score ledger anomaly detection.",
            "category": "Business & Finance",
            "is_hitl": True,
        },
        "it_ops": {
            "title": "IT Operations Agent",
            "description": "Log anomaly RCA, Prometheus diagnostics, and gated pod remediation.",
            "category": "Engineering & Operations",
            "is_hitl": True,
        },
        "workflow_automation": {
            "title": "Workflow Automation Agent",
            "description": "Multi-agent DAG workflow orchestration with topological sorting.",
            "category": "Engineering & Operations",
            "is_hitl": True,
        },
        "data_analyst": {
            "title": "Data Analyst Agent",
            "description": "Text-to-SQL with AST query security guards and Plotly chart generation.",
            "category": "Business & Finance",
            "is_hitl": False,
        },
    }

    # Ensure all supported kinds are present in results for the UI
    seen_kinds = set()
    results = []
    for a in db_agents:
        if a.kind in seen_kinds:
            continue
        seen_kinds.add(a.kind)
        item = {
            "id": str(a.id),
            "name": a.name,
            "slug": a.slug,
            "kind": a.kind,
            "description": a.description,
            "config": a.config or {},
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "metadata": agent_metadata.get(a.kind, {}),
        }
        results.append(item)

    # For supported kinds not yet created as explicit agent instances, add virtual cards
    for kind in supported:
        if kind not in seen_kinds:
            meta = agent_metadata.get(kind, {})
            results.append({
                "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, kind)),
                "name": meta.get("title", kind.replace("_", " ").title()),
                "slug": kind,
                "kind": kind,
                "description": meta.get("description", f"Specialized {kind} agent."),
                "config": {},
                "created_at": datetime.now(timezone.utc).isoformat(),
                "metadata": meta,
            })

    return results


@router.post("/agents", status_code=201)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    if payload.kind not in agent_registry.supported_kinds():
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported agent kind: {payload.kind}. Available: {agent_registry.supported_kinds()}",
        )
    base = make_slug(payload.name)
    slug = base
    counter = 2
    while await db.scalar(select(Agent.id).where(Agent.slug == slug)):
        slug = f"{base}-{counter}"
        counter += 1
    agent = Agent(
        name=payload.name,
        slug=slug,
        kind=payload.kind,
        description=payload.description,
        config=payload.config,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


# ============================================================================
# 2. Unified Agent Execution & Streaming
# ============================================================================

@router.post("/agents/{slug}/run")
async def run_agent_by_slug(
    slug: str,
    payload: UnifiedRunRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute any of the 10 specialized agents by slug.
    Dispatches to agent_registry, supports sync or async ARQ execution, and HITL suspension.
    """
    # Lookup agent by slug or match kind
    agent = await db.scalar(select(Agent).where(Agent.slug == slug))
    if not agent:
        # Check if slug matches a registry kind directly
        if slug in agent_registry.supported_kinds():
            agent = Agent(
                name=slug.replace("_", " ").title(),
                slug=slug,
                kind=slug,
                description=f"Specialized {slug} agent instance",
                config={},
            )
            db.add(agent)
            await db.commit()
            await db.refresh(agent)
        else:
            raise HTTPException(status_code=404, detail=f"Agent '{slug}' not found.")

    run_payload = {
        "input_text": payload.input_text,
        "question": payload.input_text,
        "parameters": payload.parameters,
        "provider_credential_id": str(payload.provider_credential_id) if payload.provider_credential_id else None,
        **payload.parameters,
    }

    # Asynchronous queuing via Redis / ARQ
    if payload.run_async:
        arq_pool = getattr(request.app.state, "arq_pool", None)
        if not arq_pool:
            raise HTTPException(status_code=503, detail="Asynchronous job queue is not available.")
        run = AgentRun(agent_id=agent.id, status="queued", input_text=payload.input_text)
        db.add(run)
        await db.commit()
        await db.refresh(run)

        # Route heavy agents to heavy_compute queue if needed
        queue_name = "heavy_compute" if agent.kind in ("research", "workflow_automation") else "default"
        run_payload["run_id"] = str(run.id)
        run_payload["agent_id"] = str(agent.id)
        await arq_pool.enqueue_job("run_agent_job", agent.kind, run_payload, str(run.id), _queue_name=queue_name)
        return {
            "run_id": str(run.id),
            "status": "queued",
            "message": f"Job queued in '{queue_name}' worker queue.",
        }

    # Synchronous Execution
    try:
        run = await agent_engine.execute(db, agent, run_payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}") from exc

    return {
        "run_id": str(run.id),
        "status": run.status,
        "answer": run.output_text,
        "sources": run.sources,
        "duration_ms": run.duration_ms,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/agents/{slug}/runs/{run_id}/stream")
async def stream_agent_run(
    slug: str,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Server-Sent Events (SSE) streaming reasoning steps, tool calls, and final outputs."""
    async def event_generator():
        last_step_index = 0
        max_poll = 60  # max 60 seconds
        poll_count = 0

        while poll_count < max_poll:
            poll_count += 1
            # Fetch any new traces for this run
            traces = (
                await db.scalars(
                    select(AgentStepTrace)
                    .where(AgentStepTrace.run_id == run_id, AgentStepTrace.step_index > last_step_index)
                    .order_by(AgentStepTrace.step_index.asc())
                )
            ).all()

            for trace in traces:
                last_step_index = trace.step_index
                yield {
                    "event": "trace",
                    "data": json.dumps({
                        "step_index": trace.step_index,
                        "step_type": trace.step_type,
                        "tool_name": trace.tool_name,
                        "thought": trace.thought_content,
                        "tool_output": trace.tool_output,
                        "duration_ms": trace.duration_ms,
                    }),
                }

            # Check run status
            run = await db.get(AgentRun, run_id)
            if run and run.status in ("completed", "failed", "suspended_hitl"):
                yield {
                    "event": "status",
                    "data": json.dumps({
                        "status": run.status,
                        "answer": run.output_text,
                        "sources": run.sources,
                        "duration_ms": run.duration_ms,
                        "error": run.error_message,
                    }),
                }
                yield {"event": "done", "data": json.dumps({"run_id": str(run_id)})}
                break

            await asyncio.sleep(1.0)

    return EventSourceResponse(event_generator())


@router.get("/agents/runs/{run_id}/traces", response_model=list[AgentStepTraceRead])
async def get_agent_run_traces(run_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Fetch all step traces for an agent run, ordered by step_index."""
    traces = (
        await db.scalars(
            select(AgentStepTrace)
            .where(AgentStepTrace.run_id == run_id)
            .order_by(AgentStepTrace.step_index.asc())
        )
    ).all()
    return list(traces)


# ============================================================================
# 3. Human-In-The-Loop (HITL) Gate Endpoints
# ============================================================================

@router.get("/hitl/pending", response_model=list[HITLApprovalResponse])
async def list_pending_hitl_requests(db: AsyncSession = Depends(get_db)):
    """List all actions suspended waiting for human approval."""
    requests = (
        await db.scalars(
            select(HITLApprovalRequest)
            .where(HITLApprovalRequest.status == "pending")
            .order_by(HITLApprovalRequest.created_at.desc())
        )
    ).all()
    return list(requests)


async def execute_approved_action(db: AsyncSession, req: HITLApprovalRequest) -> dict[str, Any]:
    """Executes the specific gated tool upon human supervisor approval."""
    from decimal import Decimal
    action_type = req.action_type
    payload = req.action_payload or {}

    if action_type == "create_purchase_order":
        from app.models.domain_agents import PurchaseOrder, Vendor
        vendor_name = payload.get("vendor_name", "Approved Vendor")
        total_amount = Decimal(str(payload.get("total_amount", "10000.00")))
        vendor = await db.scalar(select(Vendor).where(Vendor.name == vendor_name))
        if not vendor:
            vendor = Vendor(name=vendor_name, compliance_score=100, is_active=True)
            db.add(vendor)
            await db.commit()
            await db.refresh(vendor)

        po = PurchaseOrder(
            po_number=payload.get("po_number") or f"PO-{uuid.uuid4().hex[:8].upper()}",
            vendor_id=vendor.id,
            total_amount=total_amount,
            currency=payload.get("currency", "USD"),
            status="approved",  # Approved by HITL
            line_items=payload.get("line_items", [{"item": "Authorized Service", "qty": 1, "price": float(total_amount)}]),
        )
        db.add(po)
        await db.commit()
        await db.refresh(po)
        return {
            "status": "executed",
            "po_id": str(po.id),
            "po_number": po.po_number,
            "total_amount": str(po.total_amount),
            "vendor": vendor.name,
        }

    elif action_type == "record_payment":
        from app.models.domain_agents import InvoiceRecord
        inv_num = payload.get("invoice_number")
        inv_id = payload.get("invoice_id")
        inv = None
        if inv_id:
            try:
                inv = await db.get(InvoiceRecord, uuid.UUID(str(inv_id)))
            except Exception:
                pass
        if not inv and inv_num:
            inv = await db.scalar(select(InvoiceRecord).where(InvoiceRecord.invoice_number == inv_num))
        if inv:
            inv.status = "disbursed"
            await db.commit()
        return {"status": "executed", "action": "disbursement_recorded", "invoice": inv_num or str(inv_id)}

    elif action_type == "sync_to_jira":
        from app.models.domain_agents import ActionItem
        item_id = payload.get("action_item_id")
        ticket_id = f"JIRA-{uuid.uuid4().hex[:6].upper()}"
        if item_id:
            try:
                item = await db.get(ActionItem, uuid.UUID(str(item_id)))
                if item:
                    item.status = "synced_to_jira"
                    item.external_ticket_id = ticket_id
                    await db.commit()
            except Exception:
                pass
        return {"status": "executed", "external_ticket_id": ticket_id, "action_item_id": item_id}

    elif action_type == "restart_service_pod":
        from app.models.domain_agents import IncidentTicket
        service = payload.get("service", "backend-service")
        ticket = await db.scalar(select(IncidentTicket).order_by(IncidentTicket.created_at.desc()))
        if ticket:
            ticket.status = "remediation_applied"
            logs = ticket.diagnostics_log or []
            logs.append({"remediation": f"Authorized restart applied to {service}."})
            ticket.diagnostics_log = logs
            await db.commit()
        return {"status": "executed", "action": f"Service pod '{service}' restart initiated safely."}

    return {"status": "executed", "action": action_type, "payload": payload}


@router.post("/hitl/{request_id}/approve")
async def approve_hitl_action(
    request_id: uuid.UUID,
    payload: HITLApprovalPayload,
    db: AsyncSession = Depends(get_db),
):
    """Approve a suspended HITL action and execute the authorized operation."""
    req = await db.get(HITLApprovalRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="HITL request not found.")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"Request already resolved with status: {req.status}")

    req.status = "approved"
    req.reviewer_notes = payload.reviewer_notes or "Approved by supervisor"
    req.reviewed_at = datetime.now(timezone.utc)
    if payload.modified_payload:
        req.action_payload = payload.modified_payload

    # Execute the gated tool action
    exec_result = await execute_approved_action(db, req)

    # Update associated run status
    run = await db.get(AgentRun, req.run_id)
    if run:
        run.status = "completed"
        run.output_text = (
            f"Action '{req.action_type}' was approved and executed successfully.\n"
            f"Execution details: {json.dumps(exec_result, default=str)}"
        )

    # Persist execution trace
    trace = AgentStepTrace(
        run_id=req.run_id,
        step_index=99,
        step_type="hitl_authorized_execution",
        tool_name=req.action_type,
        tool_input=req.action_payload,
        tool_output=exec_result,
        thought_content=f"Authorized by human supervisor. Notes: {req.reviewer_notes}",
        duration_ms=0,
    )
    db.add(trace)

    await db.commit()
    await db.refresh(req)
    return {
        "status": "approved",
        "request_id": str(req.id),
        "execution_result": exec_result,
        "reviewed_at": req.reviewed_at.isoformat(),
    }


@router.post("/hitl/{request_id}/reject")
async def reject_hitl_action(
    request_id: uuid.UUID,
    payload: HITLApprovalPayload,
    db: AsyncSession = Depends(get_db),
):
    """Reject a suspended HITL action with reviewer justification."""
    req = await db.get(HITLApprovalRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="HITL request not found.")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"Request already resolved with status: {req.status}")

    req.status = "rejected"
    req.reviewer_notes = payload.reviewer_notes or "Rejected by supervisor."
    req.reviewed_at = datetime.now(timezone.utc)

    run = await db.get(AgentRun, req.run_id)
    if run:
        run.status = "cancelled"
        run.output_text = f"Action '{req.action_type}' was rejected by reviewer: {req.reviewer_notes}"

    trace = AgentStepTrace(
        run_id=req.run_id,
        step_index=99,
        step_type="hitl_rejected",
        tool_name=req.action_type,
        tool_input=req.action_payload,
        tool_output={"rejected": True, "reason": req.reviewer_notes},
        thought_content=f"Human reviewer rejected action: {req.reviewer_notes}",
        duration_ms=0,
    )
    db.add(trace)

    await db.commit()
    await db.refresh(req)
    return {"status": "rejected", "request_id": str(req.id), "reviewer_notes": req.reviewer_notes}


# ============================================================================
# 4. Backward-Compatible Run Endpoints
# ============================================================================

@router.post("/agents/{agent_id}/runs", response_model=AgentRunRead, status_code=201)
async def run_agent_by_id(
    agent_id: uuid.UUID,
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    try:
        run = await agent_engine.execute(db, agent, payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent execution failed: {exc}") from exc
    return AgentRunRead.from_model(run)


@router.get("/agents/runs", response_model=list[AgentRunRead])
async def list_runs(limit: int = 25, db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 100))
    runs = (await db.scalars(select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit))).all()
    return [AgentRunRead.from_model(run) for run in runs]

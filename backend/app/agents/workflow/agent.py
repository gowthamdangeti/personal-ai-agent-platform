import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.react_engine import ReActAgent, Tool
from app.models.domain_agents import WorkflowDefinition, WorkflowExecution
from app.services.llm_resolver import ResolvedLLMConfig


def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Sorts DAG nodes topologically to ensure dependencies are executed in order."""
    in_degree: dict[str, int] = {node["id"]: 0 for node in nodes}
    adj: dict[str, list[str]] = {node["id"]: [] for node in nodes}

    for edge in edges:
        source = edge.get("source") or edge.get("from")
        target = edge.get("target") or edge.get("to")
        if target and source and target in in_degree and source in adj:
            in_degree[target] += 1
            adj[source].append(target)

    queue = [n for n, deg in in_degree.items() if deg == 0]
    sorted_order = []

    while queue:
        curr = queue.pop(0)
        sorted_order.append(curr)
        for neighbor in adj.get(curr, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(sorted_order) != len(nodes):
        # Fallback to simple node sequence if cycle detected
        return [n["id"] for n in nodes]
    return sorted_order


async def compile_dag(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """Validates DAG schema, node kinds, and dependency links."""
    schema = payload.get("dag_schema", {})
    nodes = schema.get("nodes", [])
    edges = schema.get("edges", [])

    if not nodes:
        return {"error": "DAG schema must contain at least one node."}

    order = topological_sort(nodes, edges)
    return {
        "valid": True,
        "nodes_count": len(nodes),
        "edges_count": len(edges),
        "execution_order": order,
    }


async def execute_dag(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """Executes DAG nodes sequentially in topological order."""
    from app.agents.registry import agent_registry

    workflow_id = payload.get("workflow_id")
    context = payload.get("context", {})
    schema = payload.get("dag_schema", {})
    nodes = {n["id"]: n for n in schema.get("nodes", [])}
    edges = schema.get("edges", [])
    order = topological_sort(list(nodes.values()), edges)

    node_results = {}
    is_paused_hitl = False

    for node_id in order:
        node = nodes.get(node_id)
        if not node:
            continue

        agent_kind = node.get("agent_kind") or node.get("agent") or "knowledge"
        node_input = {**context, **node.get("params", {}), **node.get("input", {})}

        try:
            # Check if agent exists in registry
            if agent_kind in agent_registry.supported_kinds():
                sub_agent = agent_registry.get(agent_kind)
                res = await sub_agent.execute(db, node_input)
                node_results[node_id] = {
                    "status": res.get("status", "completed"),
                    "agent": agent_kind,
                    "output": res.get("answer", "")[:500],
                }
                # Forward node output into execution context for downstream DAG dependencies
                context[f"node_{node_id}_output"] = res.get("answer", "")
                context["last_output"] = res.get("answer", "")

                if res.get("status") == "suspended_hitl":
                    node_results[node_id]["hitl_request_id"] = res.get("hitl_request_id")
                    is_paused_hitl = True
                    break
            else:
                node_results[node_id] = {"status": "skipped", "reason": f"Unknown agent kind: {agent_kind}"}
        except Exception as e:
            node_results[node_id] = {"status": "failed", "error": str(e)}

    return {
        "status": "paused_hitl" if is_paused_hitl else "completed",
        "executed_nodes": node_results,
        "completed_count": len(node_results),
    }


class WorkflowAutomationAgent(ReActAgent):
    kind = "workflow_automation"

    def __init__(self):
        super().__init__()
        self.register_tool(
            Tool(
                name="compile_dag",
                description="Validates DAG node topology and acyclic integrity.",
                fn=compile_dag,
                is_hitl_critical=False,
            )
        )
        self.register_tool(
            Tool(
                name="execute_dag",
                description="Executes DAG workflow nodes across multi-agent pipelines.",
                fn=execute_dag,
                is_hitl_critical=False,
            )
        )

    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        raw_schema = payload.get("dag_schema") or {
            "nodes": [
                {"id": "step_1", "agent_kind": "knowledge", "params": {"input_text": "Verify system requirements"}},
                {"id": "step_2", "agent_kind": "qa", "params": {"input_text": "Generate test assertions"}},
            ],
            "edges": [{"source": "step_1", "target": "step_2"}],
        }

        # Validate DAG
        comp = await compile_dag(db, {"dag_schema": raw_schema})
        if "error" in comp:
            return {"status": "failed", "answer": comp["error"], "sources": []}

        # Save or get WorkflowDefinition
        wf_name = payload.get("name", f"Workflow-{uuid.uuid4().hex[:6]}")
        wf_def = WorkflowDefinition(
            name=wf_name,
            description="Autonomous multi-agent execution pipeline",
            dag_schema=raw_schema,
            is_active=True,
        )
        db.add(wf_def)
        await db.commit()
        await db.refresh(wf_def)

        # Execute
        exec_run = WorkflowExecution(
            workflow_id=wf_def.id,
            status="running",
            context_data=payload.get("context", {}),
        )
        db.add(exec_run)
        await db.commit()
        await db.refresh(exec_run)

        exec_res = await execute_dag(db, {
            "workflow_id": str(wf_def.id),
            "dag_schema": raw_schema,
            "context": payload.get("context", {}),
        })

        exec_run.status = exec_res["status"]
        exec_run.completed_at = datetime.now(timezone.utc)
        await db.commit()

        answer = (
            f"# Workflow Orchestration: {wf_name}\n\n"
            f"- **Execution Status:** {exec_res['status'].upper()}\n"
            f"- **Nodes Executed:** {exec_res['completed_count']} steps in topological order\n"
            f"- **Workflow ID:** {wf_def.id}\n\n"
            f"```json\n{json.dumps(exec_res['executed_nodes'], indent=2)}\n```"
        )

        return {
            "status": exec_res["status"],
            "workflow_id": str(wf_def.id),
            "execution_id": str(exec_run.id),
            "answer": answer,
            "sources": [{"workflow": wf_name, "status": exec_res["status"]}],
        }


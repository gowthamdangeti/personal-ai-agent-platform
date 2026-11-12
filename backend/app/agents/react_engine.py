import asyncio
import json
import logging
import time
import uuid
from typing import Any, Callable, Coroutine
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.base import BaseAgent
from app.models.domain_agents import AgentStepTrace, HITLApprovalRequest
from app.services.llm import llm_service
from app.services.llm_resolver import ResolvedLLMConfig

logger = logging.getLogger(__name__)


class Tool:
    """Executable capability exposed to a ReAct agent."""

    def __init__(
        self,
        name: str,
        description: str,
        fn: Callable[[AsyncSession, dict[str, Any]], Coroutine[Any, Any, Any]],
        is_hitl_critical: bool = False,
    ):
        self.name = name
        self.description = description
        self.fn = fn
        self.is_hitl_critical = is_hitl_critical


class ReActAgent(BaseAgent):
    """
    Autonomous ReAct (Reasoning + Acting) Agent Engine.
    Executes a structured loop of Thought -> Action -> Observation with safety gates.
    """
    kind: str = "react_base"

    def __init__(self):
        self.tools: dict[str, Tool] = {}

    def register_tool(self, tool: Tool):
        self.tools[tool.name] = tool

    def get_tool_definitions(self) -> str:
        if not self.tools:
            return "No external tools registered."
        lines = []
        for tool in self.tools.values():
            hitl_marker = " [STRICT HITL REQUIRED - High impact write action]" if tool.is_hitl_critical else ""
            lines.append(f"- {tool.name}: {tool.description}{hitl_marker}")
        return "\n".join(lines)

    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        """
        Execute task through the ReAct loop until final answer is reached or max_iterations hit.
        """
        input_text = (
            payload.get("input_text")
            or payload.get("question")
            or payload.get("instructions")
            or json.dumps(payload, ensure_ascii=False, default=str)
        )
        max_iterations = int(payload.get("max_iterations", 5))
        run_id = payload.get("run_id")
        if isinstance(run_id, str):
            try:
                run_id = uuid.UUID(run_id)
            except ValueError:
                run_id = uuid.uuid4()
        elif not isinstance(run_id, uuid.UUID):
            run_id = uuid.uuid4()

        agent_id = payload.get("agent_id")
        if isinstance(agent_id, str):
            try:
                agent_id = uuid.UUID(agent_id)
            except ValueError:
                agent_id = None

        # Ensure agent and agent_run records exist to satisfy foreign key constraints
        from app.models.agent import Agent, AgentRun
        if not agent_id:
            db_agent = await db.scalar(select(Agent).where(Agent.kind == self.kind))
            if not db_agent:
                db_agent = Agent(
                    name=self.kind.replace("_", " ").title(),
                    slug=self.kind,
                    kind=self.kind,
                    description=f"{self.kind} agent instance",
                )
                db.add(db_agent)
                await db.commit()
                await db.refresh(db_agent)
            agent_id = db_agent.id

        db_run = await db.get(AgentRun, run_id)
        if not db_run:
            db_run = AgentRun(
                id=run_id,
                agent_id=agent_id,
                status="running",
                input_text=str(input_text)[:500],
            )
            db.add(db_run)
            await db.commit()

        system_prompt = (
            f"You are the {self.kind} AI Agent on the Personal AI Agent Platform.\n"
            "You solve requests through structured reasoning and tool execution.\n\n"
            f"AVAILABLE TOOLS:\n{self.get_tool_definitions()}\n\n"
            "OUTPUT FORMAT RULES:\n"
            "1. You must respond ONLY in strict, valid JSON without extra text or markdown fences.\n"
            "2. When invoking a tool, respond with:\n"
            '   {"thought": "<reasoning>", "action": {"tool": "<tool_name>", "input": {<tool_args>}}}\n'
            "3. When you have completed the task and have a final answer, respond with:\n"
            '   {"thought": "<final synthesis>", "final_answer": "<markdown response>", "sources": [<source_metadata>]}\n'
            "4. Never output plain text outside the JSON object.\n"
        )

        conversation: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Task instructions:\n{input_text}"},
        ]

        collected_sources: list[dict] = []

        for step in range(1, max_iterations + 1):
            step_start = time.perf_counter()
            try:
                raw_response = await llm_service.chat_completion(
                    messages=conversation,
                    llm_config=llm_config,
                    response_format={"type": "json_object"},
                )
            except Exception as e:
                logger.warning("LLM completion error in ReAct loop: %s", e)
                raw_response = json.dumps({
                    "thought": f"Encountered LLM invocation issue: {e}",
                    "final_answer": f"Unable to complete LLM completion: {e}",
                    "sources": [],
                })

            parsed = self._parse_llm_json(raw_response)
            thought = parsed.get("thought", "")

            # Check for Final Answer
            if "final_answer" in parsed:
                step_duration = int((time.perf_counter() - step_start) * 1000)
                sources = parsed.get("sources", []) or collected_sources
                trace = AgentStepTrace(
                    run_id=run_id,
                    step_index=step,
                    step_type="final_synthesis",
                    thought_content=thought,
                    duration_ms=step_duration,
                )
                db.add(trace)
                await db.commit()

                return {
                    "status": "completed",
                    "answer": parsed["final_answer"],
                    "sources": sources,
                    "steps_count": step,
                }

            # Handle Action & Tool Invocation
            action = parsed.get("action")
            if not isinstance(action, dict):
                # Fallback: model gave thought but no action or final_answer
                step_duration = int((time.perf_counter() - step_start) * 1000)
                trace = AgentStepTrace(
                    run_id=run_id,
                    step_index=step,
                    step_type="thought",
                    thought_content=thought,
                    duration_ms=step_duration,
                )
                db.add(trace)
                await db.commit()
                return {
                    "status": "completed",
                    "answer": thought or "Task concluded without tool execution.",
                    "sources": collected_sources,
                    "steps_count": step,
                }

            tool_name = action.get("tool")
            tool_input = action.get("input", {})
            if not isinstance(tool_input, dict):
                tool_input = {"raw": tool_input}

            tool = self.tools.get(tool_name) if tool_name else None

            # Tool not found
            if not tool:
                observation = {"error": f"Tool '{tool_name}' not found. Available: {list(self.tools.keys())}"}
                step_duration = int((time.perf_counter() - step_start) * 1000)
                trace = AgentStepTrace(
                    run_id=run_id,
                    step_index=step,
                    step_type="tool_error",
                    tool_name=tool_name,
                    tool_input=tool_input,
                    tool_output=observation,
                    thought_content=thought,
                    duration_ms=step_duration,
                )
                db.add(trace)
                await db.commit()

                conversation.append({"role": "assistant", "content": json.dumps(parsed)})
                conversation.append({"role": "user", "content": f"Observation: {json.dumps(observation)}"})
                continue

            # HITL Safety Check: Intercept high-impact/write operations
            if tool.is_hitl_critical:
                hitl_req = HITLApprovalRequest(
                    run_id=run_id,
                    agent_id=agent_id or uuid.uuid4(),
                    action_type=tool.name,
                    action_payload=tool_input,
                    status="pending",
                )
                db.add(hitl_req)

                step_duration = int((time.perf_counter() - step_start) * 1000)
                trace = AgentStepTrace(
                    run_id=run_id,
                    step_index=step,
                    step_type="hitl_suspension",
                    tool_name=tool.name,
                    tool_input=tool_input,
                    thought_content=thought,
                    duration_ms=step_duration,
                )
                db.add(trace)
                await db.commit()
                await db.refresh(hitl_req)

                return {
                    "status": "suspended_hitl",
                    "hitl_request_id": str(hitl_req.id),
                    "action_type": tool.name,
                    "action_payload": tool_input,
                    "answer": (
                        f"Action '{tool.name}' requires Human-in-the-Loop approval before proceeding. "
                        f"Request ID: {hitl_req.id}"
                    ),
                    "sources": collected_sources,
                    "steps_count": step,
                }

            # Safe automated tool execution
            try:
                if asyncio.iscoroutinefunction(tool.fn):
                    observation = await tool.fn(db, tool_input)
                else:
                    observation = tool.fn(db, tool_input)
            except Exception as exc:
                logger.exception("Error executing tool %s", tool_name)
                observation = {"error": f"Tool execution error: {str(exc)}"}

            # Collect sources if returned in observation
            if isinstance(observation, dict) and "sources" in observation and isinstance(observation["sources"], list):
                collected_sources.extend(observation["sources"])

            step_duration = int((time.perf_counter() - step_start) * 1000)
            trace = AgentStepTrace(
                run_id=run_id,
                step_index=step,
                step_type="tool_execution",
                tool_name=tool.name,
                tool_input=tool_input,
                tool_output=observation if isinstance(observation, dict) else {"result": str(observation)},
                thought_content=thought,
                duration_ms=step_duration,
            )
            db.add(trace)
            await db.commit()

            conversation.append({"role": "assistant", "content": json.dumps(parsed)})
            conversation.append({"role": "user", "content": f"Observation: {json.dumps(observation, default=str)}"})

        # Reached max iterations without concluding
        return {
            "status": "completed",
            "answer": "Reached maximum allowed reasoning iterations. Results based on observations captured.",
            "sources": collected_sources,
            "steps_count": max_iterations,
        }

    def _parse_llm_json(self, text: str) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except Exception:
            return {"thought": "Synthesizing response", "final_answer": text, "sources": []}


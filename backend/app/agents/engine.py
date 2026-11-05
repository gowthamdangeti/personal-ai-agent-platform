import json
import time
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.registry import agent_registry
from app.models.agent import Agent, AgentRun
from app.services.llm_resolver import resolve_llm_config


class AgentEngine:
    """Shared execution lifecycle for every agent type with BYOK LLM provider resolution."""

    async def execute(self, db: AsyncSession, agent: Agent, payload: dict) -> AgentRun:
        runner = agent_registry.get(agent.kind)
        run_input = (
            payload.get("question")
            or payload.get("instructions")
            or json.dumps(payload, ensure_ascii=False, default=str)
        )
        run = AgentRun(agent_id=agent.id, status="running", input_text=run_input)
        db.add(run)
        await db.commit()
        await db.refresh(run)

        # Hierarchical BYOK resolution: payload overrides -> agent config -> default credential -> fallback
        llm_config = await resolve_llm_config(db, payload=payload, agent_config=agent.config)

        started = time.perf_counter()
        try:
            result = await runner.execute(db, payload, llm_config=llm_config)
            run.status = "completed"
            run.output_text = result.get("answer", "")
            run.sources = result.get("sources", [])
        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)[:2000]
            raise
        finally:
            run.duration_ms = int((time.perf_counter() - started) * 1000)
            await db.commit()
            await db.refresh(run)
        return run


agent_engine = AgentEngine()

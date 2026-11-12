import json
import uuid
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.db.base import Base
from app.agents.react_engine import ReActAgent, Tool
from app.models.agent import Agent, AgentRun
from app.models.domain_agents import AgentStepTrace, HITLApprovalRequest

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def in_memory_db():
    async with TestSessionLocal() as session:
        yield session
        from sqlalchemy import delete
        await session.execute(delete(Agent).where(Agent.kind.in_(['test', 'gated'])))
        await session.commit()


@pytest.mark.asyncio
async def test_react_engine_tool_call_and_trace(in_memory_db):
    agent = ReActAgent()
    agent.kind = "test_agent"

    async def sample_tool(db, payload):
        return {"result": f"processed {payload.get('input_val')}"}

    agent.register_tool(Tool(
        name="sample_tool",
        description="A sample tool for testing.",
        fn=sample_tool,
        is_hitl_critical=False,
    ))

    # Mock LLM chat_completion sequence:
    # 1. Thought + Tool Call
    # 2. Thought + Final Answer
    responses = [
        json.dumps({
            "thought": "I need to call sample_tool.",
            "action": {"tool": "sample_tool", "input": {"input_val": "data_42"}},
        }),
        json.dumps({
            "thought": "I now have the observation and can conclude.",
            "final_answer": "Final synthesis completed successfully.",
            "sources": [{"test": True}],
        }),
    ]

    mock_chat = AsyncMock(side_effect=responses)

    # Create dummy agent and run in DB
    slug = f"test-{uuid.uuid4().hex[:8]}"
    db_agent = Agent(name="Test", slug=slug, kind="test")
    in_memory_db.add(db_agent)
    await in_memory_db.commit()

    run_id = uuid.uuid4()
    db_run = AgentRun(id=run_id, agent_id=db_agent.id, input_text="Run test")
    in_memory_db.add(db_run)
    await in_memory_db.commit()

    with patch("app.agents.react_engine.llm_service.chat_completion", mock_chat):
        result = await agent.execute(
            in_memory_db,
            {"input_text": "Run test", "run_id": run_id, "agent_id": db_agent.id},
        )

    assert result["status"] == "completed"
    assert "Final synthesis" in result["answer"]
    assert len(result["sources"]) == 1

    # Check AgentStepTrace persisted
    from sqlalchemy import select
    traces = (
        await in_memory_db.scalars(
            select(AgentStepTrace).where(AgentStepTrace.run_id == run_id).order_by(AgentStepTrace.step_index.asc())
        )
    ).all()
    assert len(traces) == 2
    assert traces[0].tool_name == "sample_tool"
    assert traces[0].step_type == "tool_execution"
    assert traces[1].step_type == "final_synthesis"


@pytest.mark.asyncio
async def test_react_engine_hitl_suspension(in_memory_db):
    agent = ReActAgent()
    agent.kind = "gated_agent"

    async def destructive_action(db, payload):
        return {"status": "destroyed"}

    agent.register_tool(Tool(
        name="destructive_action",
        description="A dangerous tool requiring supervisor authorization.",
        fn=destructive_action,
        is_hitl_critical=True,  # Strict HITL
    ))

    # LLM requests the critical tool
    mock_chat = AsyncMock(return_value=json.dumps({
        "thought": "I must execute the destructive action.",
        "action": {"tool": "destructive_action", "input": {"target": "resource_1"}},
    }))

    slug = f"gated-{uuid.uuid4().hex[:8]}"
    db_agent = Agent(name="Gated", slug=slug, kind="gated")
    in_memory_db.add(db_agent)
    await in_memory_db.commit()

    run_id = uuid.uuid4()
    db_run = AgentRun(id=run_id, agent_id=db_agent.id, input_text="Execute dangerous action")
    in_memory_db.add(db_run)
    await in_memory_db.commit()

    with patch("app.agents.react_engine.llm_service.chat_completion", mock_chat):
        result = await agent.execute(
            in_memory_db,
            {"input_text": "Execute dangerous action", "run_id": run_id, "agent_id": db_agent.id},
        )

    assert result["status"] == "suspended_hitl"
    assert "destructive_action" in result["action_type"]
    assert "hitl_request_id" in result

    # Verify HITLApprovalRequest record created
    from sqlalchemy import select
    hitl_req = await in_memory_db.get(HITLApprovalRequest, uuid.UUID(result["hitl_request_id"]))
    assert hitl_req is not None
    assert hitl_req.status == "pending"
    assert hitl_req.action_type == "destructive_action"
    assert hitl_req.action_payload == {"target": "resource_1"}


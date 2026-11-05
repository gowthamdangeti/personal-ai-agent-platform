from app.agents.knowledge.agent import KnowledgeAgent
from app.agents.document_processing.agent import DocumentProcessingAgent


class AgentRegistry:
    def __init__(self):
        self._agents = {"knowledge": KnowledgeAgent, "document_processing": DocumentProcessingAgent}

    def get(self, kind: str):
        agent_class = self._agents.get(kind)
        if agent_class is None:
            raise ValueError(f"Unknown agent kind: {kind}")
        return agent_class()

    def supported_kinds(self) -> list[str]:
        return sorted(self._agents.keys())


agent_registry = AgentRegistry()

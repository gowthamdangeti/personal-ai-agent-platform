from app.agents.knowledge.agent import KnowledgeAgent
from app.agents.document_processing.agent import DocumentProcessingAgent
from app.agents.research.agent import ResearchAgent
from app.agents.meeting_intelligence.agent import MeetingIntelligenceAgent
from app.agents.qa.agent import QAAgent
from app.agents.procurement.agent import ProcurementAgent
from app.agents.finance.agent import FinanceAgent
from app.agents.it_ops.agent import ITOperationsAgent
from app.agents.workflow.agent import WorkflowAutomationAgent
from app.agents.data_analyst.agent import DataAnalystAgent


class AgentRegistry:
    def __init__(self):
        self._agents = {
            "knowledge": KnowledgeAgent,
            "document_processing": DocumentProcessingAgent,
            "research": ResearchAgent,
            "meeting_intelligence": MeetingIntelligenceAgent,
            "qa": QAAgent,
            "procurement": ProcurementAgent,
            "finance": FinanceAgent,
            "it_ops": ITOperationsAgent,
            "workflow_automation": WorkflowAutomationAgent,
            "data_analyst": DataAnalystAgent,
        }

    def get(self, kind: str):
        agent_class = self._agents.get(kind)
        if agent_class is None:
            raise ValueError(f"Unknown agent kind: '{kind}'. Available: {self.supported_kinds()}")
        return agent_class()

    def supported_kinds(self) -> list[str]:
        return sorted(self._agents.keys())


agent_registry = AgentRegistry()

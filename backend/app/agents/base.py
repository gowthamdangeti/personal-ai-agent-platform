from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.llm_resolver import ResolvedLLMConfig


class BaseAgent(ABC):
    kind: str

    @abstractmethod
    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        """Execute one agent request and return {answer, sources}."""
        raise NotImplementedError

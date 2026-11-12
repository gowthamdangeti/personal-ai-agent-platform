from fastapi import APIRouter
from app.api.v1 import (
    agents,
    auth,
    dashboard,
    data_analyst,
    document_processing,
    documents,
    finance,
    health,
    integrations,
    it_ops,
    knowledge,
    meeting_intelligence,
    procurement,
    qa,
    research,
    settings,
    workflow,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/api/v1")
api_router.include_router(agents.router, prefix="/api/v1")
api_router.include_router(documents.router, prefix="/api/v1")
api_router.include_router(dashboard.router, prefix="/api/v1")
api_router.include_router(settings.router, prefix="/api/v1")
api_router.include_router(integrations.router, prefix="/api/v1")

# Specialized domain agent routes
api_router.include_router(knowledge.router, prefix="/api/v1")
api_router.include_router(document_processing.router, prefix="/api/v1")
api_router.include_router(research.router, prefix="/api/v1")
api_router.include_router(meeting_intelligence.router, prefix="/api/v1")
api_router.include_router(qa.router, prefix="/api/v1")
api_router.include_router(procurement.router, prefix="/api/v1")
api_router.include_router(finance.router, prefix="/api/v1")
api_router.include_router(it_ops.router, prefix="/api/v1")
api_router.include_router(workflow.router, prefix="/api/v1")
api_router.include_router(data_analyst.router, prefix="/api/v1")

from fastapi import APIRouter
from app.api.v1 import agents, dashboard, documents, health, settings

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(agents.router, prefix="/api/v1")
api_router.include_router(documents.router, prefix="/api/v1")
api_router.include_router(dashboard.router, prefix="/api/v1")
api_router.include_router(settings.router, prefix="/api/v1")

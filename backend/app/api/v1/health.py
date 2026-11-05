from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.db.session import engine
from app.services.storage import storage
import asyncio

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def liveness():
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(request: Request):
    checks = {"database": False, "redis": False, "object_storage": False}
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass
    try:
        await request.app.state.arq_pool.ping()
        checks["redis"] = True
    except Exception:
        pass
    try:
        await asyncio.to_thread(storage.check)
        checks["object_storage"] = True
    except Exception:
        pass
    ready = all(checks.values())
    return JSONResponse(status_code=200 if ready else 503, content={"status": "ready" if ready else "not_ready", "checks": checks})

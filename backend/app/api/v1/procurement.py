from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import PurchaseOrder, Vendor
from app.schemas.agent_payloads import ProcurementRFPRequest
from app.agents.procurement.agent import ProcurementAgent, score_vendors

router = APIRouter(prefix="/procurement", tags=["procurement"])


@router.post("/compare-quotes")
async def compare_quotes_endpoint(
    payload: ProcurementRFPRequest,
    db: AsyncSession = Depends(get_db),
):
    return await score_vendors(db, {"quotes": payload.vendor_quotes, "requirements": payload.requirements})


@router.get("/purchase-orders")
async def list_purchase_orders(db: AsyncSession = Depends(get_db)):
    pos = (await db.scalars(select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(20))).all()
    return list(pos)


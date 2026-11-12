from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.domain_agents import InvoiceRecord, ReconciliationAudit
from app.schemas.agent_payloads import FinanceReconcileRequest
from app.agents.finance.agent import FinanceAgent, detect_anomalies

router = APIRouter(prefix="/finance", tags=["finance"])


@router.post("/reconcile-invoice")
async def reconcile_invoice_endpoint(
    payload: FinanceReconcileRequest,
    db: AsyncSession = Depends(get_db),
):
    agent = FinanceAgent()
    return await agent.execute(
        db,
        {
            "invoice_number": payload.invoice_number,
            "vendor_name": payload.vendor_name,
            "amount": payload.amount,
            "po_number": payload.po_number,
        },
    )


@router.get("/anomalies")
async def list_financial_anomalies(db: AsyncSession = Depends(get_db)):
    return await detect_anomalies(db, {"period": "current_quarter"})


@router.get("/invoices")
async def list_invoices(db: AsyncSession = Depends(get_db)):
    invoices = (await db.scalars(select(InvoiceRecord).order_by(InvoiceRecord.created_at.desc()).limit(25))).all()
    return list(invoices)


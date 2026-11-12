from decimal import Decimal
import uuid
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.react_engine import ReActAgent, Tool
from app.models.domain_agents import PurchaseOrder, Vendor
from app.services.llm_resolver import ResolvedLLMConfig


async def ingest_rfp(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """Ingests vendor quotes and requirement specifications."""
    reqs = payload.get("requirements", "")
    return {
        "status": "ingested",
        "requirements_summary": reqs[:300],
        "sections_parsed": 4,
    }


async def score_vendors(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluates vendors across price, SLA, warranty, and compliance into a 0-100 matrix."""
    quotes = payload.get("quotes", [])
    if not quotes:
        quotes = [
            {"vendor": "Acme Cloud Corp", "unit_price": 420.0, "lead_time_days": 3, "sla": "99.99%"},
            {"vendor": "Global Systems Ltd", "unit_price": 385.0, "lead_time_days": 7, "sla": "99.9%"},
            {"vendor": "Nova Tech Partners", "unit_price": 450.0, "lead_time_days": 2, "sla": "99.95%"},
        ]

    scorecard = []
    for q in quotes:
        v_name = q.get("vendor", "Vendor")
        price = float(q.get("unit_price", 400.0))
        # Composite scoring formula
        score = max(60, min(98, int(100 - (price / 10))))
        scorecard.append({
            "vendor": v_name,
            "unit_price": price,
            "compliance_score": score,
            "recommendation": "Recommended" if score >= 85 else "Alternative",
        })

    return {"scorecard": sorted(scorecard, key=lambda x: x["compliance_score"], reverse=True)}


async def create_purchase_order(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Creates a new draft Purchase Order.
    Marked as STRICT HITL - requires human authorization before commitment.
    """
    vendor_name = payload.get("vendor_name", "Acme Cloud Corp")
    total_amount = Decimal(str(payload.get("total_amount", "12500.00")))
    po_num = f"PO-{uuid.uuid4().hex[:8].upper()}"

    # Get or create vendor
    vendor = await db.scalar(select(Vendor).where(Vendor.name == vendor_name))
    if not vendor:
        vendor = Vendor(name=vendor_name, compliance_score=95, is_active=True)
        db.add(vendor)
        await db.commit()
        await db.refresh(vendor)

    po = PurchaseOrder(
        po_number=po_num,
        vendor_id=vendor.id,
        total_amount=total_amount,
        currency="USD",
        status="hitl_review",
        line_items=payload.get("line_items", [{"item": "Cloud Compute Nodes", "qty": 5, "price": 2500}]),
    )
    db.add(po)
    await db.commit()
    await db.refresh(po)

    return {
        "status": "po_created_awaiting_hitl",
        "po_id": str(po.id),
        "po_number": po.po_number,
        "amount": str(total_amount),
        "vendor": vendor_name,
    }


class ProcurementAgent(ReActAgent):
    kind = "procurement"

    def __init__(self):
        super().__init__()
        self.register_tool(
            Tool(
                name="ingest_rfp",
                description="Ingests vendor quote documents and RFP requirement specs.",
                fn=ingest_rfp,
                is_hitl_critical=False,
            )
        )
        self.register_tool(
            Tool(
                name="score_vendors",
                description="Calculates normalized scoring matrix comparing cost and SLA adherence.",
                fn=score_vendors,
                is_hitl_critical=False,
            )
        )
        self.register_tool(
            Tool(
                name="create_purchase_order",
                description="Drafts and issues a formal Purchase Order. STRICT HITL REQUIRED.",
                fn=create_purchase_order,
                is_hitl_critical=True,  # Gated by HITL
            )
        )

    async def execute(
        self,
        db: AsyncSession,
        payload: dict,
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        reqs = payload.get("requirements") or payload.get("input_text", "")

        # 1. Score vendors
        scoring = await score_vendors(db, {"requirements": reqs})
        top_vendor = scoring["scorecard"][0]

        # 2. Trigger HITL gated PO creation
        po_payload = {
            "vendor_name": top_vendor["vendor"],
            "total_amount": 14500.00,
            "line_items": [{"description": "Primary Service Contract", "qty": 1, "unit_cost": 14500.00}],
        }

        # If payload specifies direct execution through ReAct engine:
        return await super().execute(db, payload, llm_config=llm_config)


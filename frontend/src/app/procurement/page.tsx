"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileCheck, Play, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { api, ProcurementVendorScore, PurchaseOrder } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, TextareaInput } from "@/components/common/FormControls";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeleton";

const SAMPLE_QUOTES = JSON.stringify(
  [
    {
      vendor: "Apex Cloud Systems",
      unit_price: 42500,
      delivery_days: 14,
      soc2_compliant: true,
    },
    {
      vendor: "Vertex Enterprise Infra",
      unit_price: 39800,
      delivery_days: 30,
      soc2_compliant: true,
    },
    {
      vendor: "Nexus Global Hosting",
      unit_price: 46000,
      delivery_days: 10,
      soc2_compliant: true,
    },
  ],
  null,
  2,
);

export default function ProcurementPage() {
  const [requirements, setRequirements] = useState("");
  const [quotesJson, setQuotesJson] = useState(SAMPLE_QUOTES);

  const [scorecard, setScorecard] = useState<ProcurementVendorScore[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPurchaseOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const orders = await api.listPurchaseOrders();
      setPurchaseOrders(Array.isArray(orders) ? orders : []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    void loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  const jsonValidationError = useMemo(() => {
    if (!quotesJson.trim()) return "Provide at least one vendor quote JSON object.";
    try {
      const parsed = JSON.parse(quotesJson);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return "Vendor quotes must be a non-empty JSON array.";
      }
      return null;
    } catch {
      return "Invalid JSON syntax in vendor quotes.";
    }
  }, [quotesJson]);

  const handleScoreRfp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirements.trim() || jsonValidationError || scoring) return;

    setScoring(true);
    setError(null);
    try {
      const parsedQuotes = JSON.parse(quotesJson);
      const res = await api.scoreProcurementRfp(requirements.trim(), parsedQuotes);
      setScorecard(Array.isArray(res.scorecard) ? res.scorecard : []);
      await loadPurchaseOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to score vendor quotes.");
    } finally {
      setScoring(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Operations & Automation" }, { label: "Procurement RFP" }]}
        title="Procurement RFP & Vendor Matrix"
        icon={FileCheck}
        badge={
          <Badge variant="hitl" size="sm" dot>
            <ShieldAlert className="h-3 w-3 mr-1" />
            STRICT HITL POs
          </Badge>
        }
        description="Compare multi-vendor proposals against compliance, delivery, and cost constraints. Purchase Order issuance requires human approval."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loadingOrders}
            onClick={() => void loadPurchaseOrders()}
          >
            Refresh POs
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Input Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>RFP Evaluation Directive</CardTitle>
              <CardDescription>Specify evaluation criteria and vendor quote JSON array</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleScoreRfp} className="space-y-4">
              <FormGroup label="Procurement Requirements & SLA Rubric" required>
                <TextareaInput
                  rows={4}
                  placeholder="e.g. SOC2 Type II required, delivery under 21 days, target budget under $45,000, 99.9% uptime SLA..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                />
              </FormGroup>

              <FormGroup
                label="Vendor Quotes (JSON Array)"
                error={jsonValidationError || undefined}
                description="Include vendor, unit_price, delivery_days, and custom attributes."
                required
              >
                <TextareaInput
                  monospace
                  rows={9}
                  error={Boolean(jsonValidationError)}
                  value={quotesJson}
                  onChange={(e) => setQuotesJson(e.target.value)}
                />
              </FormGroup>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                icon={Play}
                loading={scoring}
                disabled={!requirements.trim() || Boolean(jsonValidationError)}
              >
                Evaluate Vendor Matrix
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Vendor Scorecard & Purchase Orders */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Weighted Vendor Scorecard</CardTitle>
                <CardDescription>Computed compliance, cost efficiency, and recommendation</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {scorecard.length === 0 ? (
                <EmptyState
                  icon={FileCheck}
                  title="No scorecard computed yet"
                  description="Enter procurement criteria and vendor quotes on the left to generate an automated comparative matrix."
                />
              ) : (
                <div className="overflow-x-auto overscroll-contain custom-scroll">
                  <table className="w-full text-left border-collapse min-w-[550px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        <th className="py-3.5 px-4">Vendor</th>
                        <th className="py-3.5 px-4">Quoted Price</th>
                        <th className="py-3.5 px-4">Compliance Score</th>
                        <th className="py-3.5 px-4">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                      {scorecard.map((row, idx) => (
                        <tr key={`${row.vendor}-${idx}`} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)]">
                            {row.vendor}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-secondary)]">
                            {formatCurrency(row.unit_price)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-2 w-24 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                                <div
                                  className="h-full bg-[#7657F6] rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, Number(row.compliance_score) || 0))}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                                {row.compliance_score}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={
                                row.recommendation?.toLowerCase().includes("shortlist") ||
                                row.recommendation?.toLowerCase().includes("approve") ||
                                row.recommendation?.toLowerCase().includes("preferred")
                                  ? "success"
                                  : "neutral"
                              }
                              size="xs"
                              dot
                            >
                              {row.recommendation}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Persisted Purchase Orders */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Purchase Orders</CardTitle>
                <CardDescription>Persisted enterprise PO records awaiting or granted approval</CardDescription>
              </div>
            </CardHeader>
            {loadingOrders ? (
              <CardContent>
                <TableSkeleton rows={3} columns={4} />
              </CardContent>
            ) : purchaseOrders.length === 0 ? (
              <CardContent>
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No purchase orders recorded yet in this workspace.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto overscroll-contain custom-scroll">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3.5 px-4">PO Number</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[var(--text-primary)]">
                          {po.po_number}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-secondary)]">
                          {formatCurrency(po.total_amount, po.currency || "USD")}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={po.status} size="xs" />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">
                          {formatDateTime(po.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

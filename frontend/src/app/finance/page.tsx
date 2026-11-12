"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  api,
  FinanceAnomalyReport,
  InvoiceRecord,
  ReconciliationResult,
} from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { AlertBanner } from "@/components/common/AlertBanner";
import { Badge, StatusBadge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { FormGroup, TextInput } from "@/components/common/FormControls";
import { MetricCard } from "@/components/common/MetricCard";
import { PageHeader } from "@/components/common/PageHeader";
import { TableSkeleton } from "@/components/common/Skeleton";

export default function FinancePage() {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [poNumber, setPoNumber] = useState("");

  const [anomalies, setAnomalies] = useState<FinanceAnomalyReport | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<{
    status: string;
    answer?: string;
    reconciliation: ReconciliationResult;
  } | null>(null);

  const loadFinanceData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [anomalyRes, invoicesRes] = await Promise.all([
        api.listFinanceAnomalies(),
        api.listInvoices(),
      ]);
      setAnomalies(anomalyRes);
      setInvoices(Array.isArray(invoicesRes) ? invoicesRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance telemetry.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  const parsedAmount = Number(amount);
  const amountInvalid = amount.trim() !== "" && (!Number.isFinite(parsedAmount) || parsedAmount <= 0);

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !vendorName.trim() || !amount.trim() || amountInvalid || reconciling) {
      return;
    }

    setReconciling(true);
    setError(null);
    try {
      const res = await api.reconcileInvoice({
        invoice_number: invoiceNumber.trim(),
        vendor_name: vendorName.trim(),
        amount: parsedAmount,
        ...(poNumber.trim() ? { po_number: poNumber.trim() } : {}),
      });
      setResult(res);
      await loadFinanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice reconciliation failed.");
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        breadcrumbs={[{ label: "Operations & Automation" }, { label: "Finance & Audit" }]}
        title="Finance Reconciliation & Spend Audit"
        icon={PieChart}
        badge={
          <Badge variant="hitl" size="sm" dot>
            <ShieldAlert className="h-3 w-3 mr-1" />
            STRICT HITL PAYOUTS
          </Badge>
        }
        description="Execute automated 3-way invoice vs. purchase order matching and inspect real-time ledger spend anomaly metrics."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loadingData}
            onClick={() => void loadFinanceData()}
          >
            Refresh Ledger
          </Button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError(null)} />}

      {/* Live Anomaly Telemetry Row */}
      {anomalies && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <MetricCard
            title="Audit Period"
            value={anomalies.period || "Current"}
            subtext={`${anomalies.sample_size} ledger entries analyzed`}
          />
          <MetricCard
            title="Mean Invoice Spend"
            value={formatCurrency(anomalies.mean_spend)}
            subtext="Rolling baseline average"
          />
          <MetricCard
            title="Spend Std Deviation"
            value={formatCurrency(anomalies.std_deviation)}
            subtext="2σ anomaly threshold basis"
          />
          <MetricCard
            title="Flagged Anomalies"
            value={anomalies.anomalies_detected?.length || 0}
            subtext="Outliers exceeding 2σ deviation"
            variant={(anomalies.anomalies_detected?.length || 0) > 0 ? "warning" : "success"}
            icon={(anomalies.anomalies_detected?.length || 0) > 0 ? AlertTriangle : CheckCircle2}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left: Reconciliation Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>3-Way Invoice Match</CardTitle>
              <CardDescription>Verify invoice values against persisted PO baselines</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReconcile} className="space-y-4">
              <FormGroup label="Invoice Number" required>
                <TextInput
                  placeholder="e.g. INV-2026-1042"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </FormGroup>

              <FormGroup label="Vendor Name" required>
                <TextInput
                  placeholder="e.g. Apex Cloud Systems"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                />
              </FormGroup>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormGroup
                  label="Invoice Amount (USD)"
                  error={amountInvalid ? "Enter a positive numeric amount." : undefined}
                  required
                >
                  <TextInput
                    type="number"
                    step="0.01"
                    placeholder="42500.00"
                    value={amount}
                    error={amountInvalid}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </FormGroup>

                <FormGroup label="PO Number (Optional)">
                  <TextInput
                    placeholder="e.g. PO-8821"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                  />
                </FormGroup>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                icon={Play}
                loading={reconciling}
                disabled={
                  !invoiceNumber.trim() ||
                  !vendorName.trim() ||
                  !amount.trim() ||
                  amountInvalid
                }
              >
                Reconcile Invoice
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Reconciliation Outcome & Ledger */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Reconciliation Audit Verdict</CardTitle>
                <CardDescription>Variance analysis and governance disposition</CardDescription>
              </div>
              {result && <StatusBadge status={result.status} />}
            </CardHeader>
            <CardContent>
              {!result ? (
                <EmptyState
                  icon={PieChart}
                  title="No active reconciliation audit"
                  description="Submit invoice and PO details on the left to compute variance and audit verdict."
                />
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Invoice</div>
                      <div className="mt-1 text-xs font-mono font-bold text-[var(--text-primary)] truncate">
                        {result.reconciliation.invoice_number}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Matched PO</div>
                      <div className="mt-1 text-xs font-mono font-bold text-[var(--text-primary)] truncate">
                        {result.reconciliation.matched_po || "None"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Variance</div>
                      <div
                        className={`mt-1 text-xs font-mono font-bold ${
                          result.reconciliation.variance === 0
                            ? "text-[#22C58B]"
                            : "text-[#F5B942]"
                        }`}
                      >
                        {formatCurrency(result.reconciliation.variance)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 p-3.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Verdict</div>
                      <div className="mt-1 text-xs font-bold text-[var(--text-primary)] truncate">
                        {result.reconciliation.audit_verdict}
                      </div>
                    </div>
                  </div>

                  {result.answer && (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-4 sm:p-5 text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto overscroll-contain custom-scroll">
                      {result.answer}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ledger Table */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invoice Ledger ({invoices.length})</CardTitle>
                <CardDescription>Persisted invoices tracked in the platform database</CardDescription>
              </div>
            </CardHeader>
            {loadingData ? (
              <CardContent>
                <TableSkeleton rows={4} columns={4} />
              </CardContent>
            ) : invoices.length === 0 ? (
              <CardContent>
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No historical invoice records stored yet in ledger.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto overscroll-contain custom-scroll">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Logged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[13px]">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[var(--text-primary)]">
                          {inv.invoice_number}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[var(--text-secondary)]">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={inv.status} size="xs" />
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[var(--text-muted)]">
                          {formatDateTime(inv.created_at)}
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

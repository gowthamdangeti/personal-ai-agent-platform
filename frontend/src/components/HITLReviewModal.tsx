"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { api, HITLApprovalRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { AlertBanner } from "./common/AlertBanner";
import { Badge } from "./common/Badge";
import { Button } from "./common/Button";
import { FormGroup, TextareaInput } from "./common/FormControls";
import { Modal } from "./common/Modal";

export interface HITLReviewModalProps {
  request: HITLApprovalRequest | null;
  isOpen?: boolean;
  onClose: () => void;
  onResolved?: (decision: "approved" | "rejected") => void;
}

export function HITLReviewModal({
  request,
  isOpen,
  onClose,
  onResolved,
}: HITLReviewModalProps) {
  const [notes, setNotes] = useState("");
  const [payloadText, setPayloadText] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setNotes("");
      setPayloadText(JSON.stringify(request.action_payload || {}, null, 2));
      setError(null);
    }
  }, [request]);

  const modalOpen = Boolean(request) && (isOpen === undefined ? true : isOpen);

  if (!request) return null;

  const handleDecision = async (decision: "approve" | "reject") => {
    setError(null);
    let modifiedPayload: Record<string, unknown> | undefined;

    if (decision === "approve" && payloadText.trim()) {
      try {
        modifiedPayload = JSON.parse(payloadText);
      } catch {
        setError("Modified action payload must be valid JSON before approving.");
        return;
      }
    }

    setSubmitting(decision);
    try {
      if (decision === "approve") {
        await api.approveHitl(request.id, notes || undefined, modifiedPayload);
        onResolved?.("approved");
      } else {
        await api.rejectHitl(request.id, notes || undefined);
        onResolved?.("rejected");
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit governance decision.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal
      open={modalOpen}
      onClose={onClose}
      title="Governance Approval Required"
      description="Inspect and optionally adjust the agent action payload prior to authorization."
      icon={ShieldAlert}
      badge={
        <Badge variant="warning" dot>
          Pending Gate
        </Badge>
      }
      maxWidth="lg"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting !== null}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={XCircle}
            loading={submitting === "reject"}
            disabled={submitting === "approve"}
            onClick={() => void handleDecision("reject")}
          >
            Reject Action
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            loading={submitting === "approve"}
            disabled={submitting === "reject"}
            onClick={() => void handleDecision("approve")}
          >
            Approve & Execute
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <AlertBanner variant="error" message={error} />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Action Type
            </div>
            <div className="mt-1 text-xs font-mono font-medium text-[var(--text-primary)] truncate">
              {request.action_type}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Execution Run ID
            </div>
            <div className="mt-1 text-xs font-mono text-[var(--text-secondary)] truncate">
              {request.run_id}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-elevated)]/60 border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Requested At
            </div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">
              {formatDateTime(request.created_at)}
            </div>
          </div>
        </div>

        <FormGroup
          label="Action Payload (Editable JSON)"
          description="You may adjust parameters in JSON before approving execution."
        >
          <TextareaInput
            monospace
            rows={7}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
          />
        </FormGroup>

        <FormGroup label="Reviewer Notes (Optional)">
          <TextareaInput
            rows={2}
            placeholder="Record rationale for audit logs..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormGroup>
      </div>
    </Modal>
  );
}

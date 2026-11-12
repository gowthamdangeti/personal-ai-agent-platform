"use client";

import React from "react";

export type BadgeVariant =
  | "automated"
  | "hitl"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  automated:
    "bg-[#22C58B]/12 text-[#22C58B] border-[#22C58B]/30",
  hitl:
    "bg-[#F5B942]/12 text-[#F5B942] border-[#F5B942]/30",
  success:
    "bg-[#22C58B]/12 text-[#22C58B] border-[#22C58B]/30",
  warning:
    "bg-[#F5B942]/12 text-[#F5B942] border-[#F5B942]/30",
  danger:
    "bg-[#F16B75]/12 text-[#F16B75] border-[#F16B75]/30",
  info:
    "bg-[#38BDF8]/12 text-[#38BDF8] border-[#38BDF8]/30",
  neutral:
    "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  accent:
    "bg-[#7657F6]/14 text-[#A78BFA] border-[#7657F6]/30",
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  automated: "bg-[#22C58B] shadow-[0_0_6px_#22C58B]",
  hitl: "bg-[#F5B942] shadow-[0_0_6px_#F5B942]",
  success: "bg-[#22C58B] shadow-[0_0_6px_#22C58B]",
  warning: "bg-[#F5B942] shadow-[0_0_6px_#F5B942]",
  danger: "bg-[#F16B75] shadow-[0_0_6px_#F16B75]",
  info: "bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]",
  neutral: "bg-[var(--text-muted)]",
  accent: "bg-[#A78BFA] shadow-[0_0_6px_#A78BFA]",
};

const SIZE_CLASSES: Record<"xs" | "sm" | "md", string> = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-0.5 text-[11px]",
  md: "px-3 py-1 text-xs",
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "xs" | "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "sm",
  dot = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold leading-none tracking-tight whitespace-nowrap select-none shadow-2xs ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT_CLASSES[variant]}`} />
      )}
      {children}
    </span>
  );
}

export function getStatusBadgeVariant(status?: string | null): BadgeVariant {
  const s = (status || "").toLowerCase();
  if (["completed", "succeeded", "ready", "approved", "healthy", "active", "matched", "verified"].includes(s)) {
    return "success";
  }
  if (["suspended_hitl", "pending", "running", "processing", "queued", "indexing", "partial", "warning"].includes(s)) {
    return s === "running" || s === "processing" || s === "queued" || s === "indexing" ? "info" : "warning";
  }
  if (["failed", "error", "rejected", "cancelled", "unhealthy", "discrepancy", "variance"].includes(s)) {
    return "danger";
  }
  if (s === "automated") return "automated";
  if (s === "hitl") return "hitl";
  return "neutral";
}

export function formatStatusLabel(status?: string | null): string {
  if (!status) return "Unknown";
  const map: Record<string, string> = {
    suspended_hitl: "Awaiting HITL",
    completed: "Completed",
    succeeded: "Completed",
    ready: "Indexed",
    pending: "Pending",
    running: "Running",
    processing: "Processing",
    failed: "Failed",
    rejected: "Rejected",
    cancelled: "Cancelled",
    approved: "Approved",
    healthy: "Healthy",
    untested: "Untested",
  };
  const key = status.toLowerCase();
  if (map[key]) return map[key];
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  size = "sm",
  dot = true,
  className = "",
}: {
  status?: string | null;
  size?: "xs" | "sm" | "md";
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={getStatusBadgeVariant(status)} size={size} dot={dot} className={className}>
      {formatStatusLabel(status)}
    </Badge>
  );
}

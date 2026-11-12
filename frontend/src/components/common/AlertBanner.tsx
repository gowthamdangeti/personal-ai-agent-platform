"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

export interface AlertBannerProps {
  variant?: "error" | "warning" | "success" | "info";
  title?: string;
  message: string;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const STYLE_MAP = {
  error: {
    wrapper: "bg-[#F16B75]/10 border-[#F16B75]/30 text-[#F16B75]",
    icon: AlertCircle,
  },
  warning: {
    wrapper: "bg-[#F5B942]/10 border-[#F5B942]/30 text-[#F5B942]",
    icon: TriangleAlert,
  },
  success: {
    wrapper: "bg-[#22C58B]/10 border-[#22C58B]/30 text-[#22C58B]",
    icon: CheckCircle2,
  },
  info: {
    wrapper: "bg-[#7657F6]/10 border-[#7657F6]/30 text-[#A78BFA]",
    icon: Info,
  },
};

export function AlertBanner({
  variant = "error",
  title,
  message,
  onDismiss,
  action,
  className = "",
}: AlertBannerProps) {
  const { wrapper, icon: Icon } = STYLE_MAP[variant];

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-start gap-3 text-sm ${wrapper} ${className}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-[var(--text-primary)] mb-0.5">{title}</p>}
        <p className="text-[13px] leading-relaxed break-words">{message}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="text-current/70 hover:text-current transition-colors shrink-0 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}


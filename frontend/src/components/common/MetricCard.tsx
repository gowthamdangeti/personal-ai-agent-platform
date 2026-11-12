"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
  badge?: React.ReactNode;
  href?: string;
  className?: string;
}

const ICON_ACCENTS: Record<NonNullable<MetricCardProps["variant"]>, string> = {
  default: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  accent: "bg-[#7657F6]/15 text-[#A78BFA] border-[#7657F6]/30 shadow-xs shadow-[#7657F6]/20",
  success: "bg-[#22C58B]/12 text-[#22C58B] border-[#22C58B]/25 shadow-xs shadow-[#22C58B]/20",
  warning: "bg-[#F5B942]/12 text-[#F5B942] border-[#F5B942]/25 shadow-xs shadow-[#F5B942]/20",
  danger: "bg-[#F16B75]/12 text-[#F16B75] border-[#F16B75]/25 shadow-xs shadow-[#F16B75]/20",
};

const BORDER_ACCENTS: Record<NonNullable<MetricCardProps["variant"]>, string> = {
  default: "border-[var(--border-subtle)]",
  accent: "border-[#7657F6]/30 hover:border-[#7657F6]/60",
  success: "border-[#22C58B]/25 hover:border-[#22C58B]/50",
  warning: "border-[#F5B942]/30 hover:border-[#F5B942]/50",
  danger: "border-[#F16B75]/30 hover:border-[#F16B75]/50",
};

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant = "default",
  badge,
  href,
  className = "",
}: MetricCardProps) {
  const inner = (
    <div
      className={`rounded-xl bg-[var(--bg-card)] border p-5 sm:p-6 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${
        BORDER_ACCENTS[variant]
      } ${
        href
          ? "hover:bg-[var(--bg-elevated)]/85 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] hover:translate-y-[-1px] cursor-pointer"
          : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold tracking-wide uppercase text-[var(--text-muted)] truncate">
              {title}
            </span>
            {badge}
          </div>
          <div className="mt-2.5 text-2xl sm:text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-none tabular-nums">
            {value}
          </div>
          {subtext && (
            <p className="mt-2.5 text-xs text-[var(--text-secondary)] truncate font-medium">
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${ICON_ACCENTS[variant]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none">
        {inner}
      </Link>
    );
  }

  return inner;
}

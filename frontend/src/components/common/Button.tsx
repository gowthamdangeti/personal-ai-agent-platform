"use client";

import React from "react";
import { Loader2, LucideIcon } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[#7657F6] hover:bg-[#896EFF] active:bg-[#6746EB] text-white border border-[#9A82FF]/40 shadow-xs shadow-[#7657F6]/25 font-semibold",
  secondary:
    "bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] hover:border-[var(--border-strong)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium shadow-2xs",
  outline:
    "bg-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-strong)] font-medium",
  danger:
    "bg-[#F16B75]/12 hover:bg-[#F16B75]/22 text-[#F16B75] border border-[#F16B75]/30 font-medium",
  ghost:
    "bg-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent font-medium",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "h-7 px-2.5 text-[11px] rounded-md gap-1",
  sm: "h-8.5 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9.5 px-3.5 text-[13px] rounded-lg gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2.5",
  icon: "h-8.5 w-8.5 p-0 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconPosition = "left",
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7657F6]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-canvas)] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : (
        Icon && iconPosition === "left" && <Icon className="h-4 w-4 shrink-0" />
      )}
      {children}
      {!loading && Icon && iconPosition === "right" && (
        <Icon className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

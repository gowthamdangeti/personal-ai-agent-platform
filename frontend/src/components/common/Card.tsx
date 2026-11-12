"use client";

import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "subtle" | "danger";
  interactive?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<CardProps["variant"]>, string> = {
  default:
    "bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-[0_1px_3px_0_rgba(0,0,0,0.25)]",
  elevated:
    "bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]",
  subtle:
    "bg-[var(--bg-sidebar)] border border-[var(--border-subtle)]",
  danger:
    "bg-[#F16B75]/5 border border-[#F16B75]/25",
};

export function Card({
  children,
  className = "",
  variant = "default",
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl transition-all duration-200 ${VARIANT_CLASSES[variant]} ${
        interactive
          ? "hover:border-[var(--border-strong)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] hover:translate-y-[-1px] cursor-pointer"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-6 py-5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-[15.5px] sm:text-[16px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-[12.5px] sm:text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/50 flex items-center justify-between gap-3 rounded-b-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)]/40 px-6 py-14 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="h-14 w-14 rounded-2xl bg-[#7657F6]/10 border border-[#7657F6]/25 flex items-center justify-center text-[#A78BFA] mb-4.5 shadow-xs">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13.5px] text-[var(--text-secondary)] max-w-md leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href}>
              <Button variant="secondary" size="sm">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button variant="secondary" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

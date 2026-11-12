"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  badge?: React.ReactNode;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function PageHeader({
  breadcrumbs,
  title,
  badge,
  description,
  icon: Icon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-7 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-6">
      <div className="min-w-0 space-y-2">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] select-none">
            {breadcrumbs.map((item, idx) => (
              <React.Fragment key={`${item.label}-${idx}`}>
                {idx > 0 && <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-[var(--text-primary)] transition-colors truncate font-medium"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-[var(--text-secondary)] truncate font-medium">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-start gap-3.5 min-w-0">
          {Icon && (
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#7657F6]/20 to-[#7657F6]/5 border border-[#7657F6]/30 flex items-center justify-center shrink-0 text-[#A78BFA] shadow-xs shadow-[#7657F6]/20 mt-0.5">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-[13.5px] text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0 sm:self-center">{actions}</div>
      )}
    </div>
  );
}

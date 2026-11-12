"use client";

import React, { useEffect } from "react";
import { LucideIcon, X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const WIDTH_MAP: Record<NonNullable<ModalProps["maxWidth"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  badge,
  maxWidth = "lg",
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    // Lock body scrolling while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${WIDTH_MAP[maxWidth]} max-h-[88vh] flex flex-col rounded-2xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            {Icon && (
              <div className="h-10 w-10 rounded-xl bg-[#7657F6]/15 border border-[#7657F6]/30 flex items-center justify-center text-[#A78BFA] shrink-0 mt-0.5 shadow-xs">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-[17px] font-semibold text-[var(--text-primary)] tracking-tight">
                  {title}
                </h2>
                {badge}
              </div>
              {description && (
                <p className="mt-1 text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="h-8.5 w-8.5 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors shrink-0 cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto overscroll-contain custom-scroll flex-1">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/70 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

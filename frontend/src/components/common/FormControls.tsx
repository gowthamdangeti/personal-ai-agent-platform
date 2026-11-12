"use client";

import React from "react";
import { ChevronDown, LucideIcon } from "lucide-react";

export interface FormGroupProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormGroup({
  label,
  description,
  error,
  required,
  children,
  className = "",
}: FormGroupProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-[13px] font-semibold text-[var(--text-primary)] tracking-tight">
          {label}
          {required && <span className="text-[#F16B75] ml-1 font-bold">*</span>}
        </label>
      )}
      {children}
      {description && !error && (
        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{description}</p>
      )}
      {error && (
        <p className="text-[12px] text-[#F16B75] font-medium leading-relaxed">{error}</p>
      )}
    </div>
  );
}

const BASE_INPUT_CLASSES =
  "w-full rounded-lg border bg-[var(--bg-input)] text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#7657F6]/30 focus:border-[#7657F6] disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon | React.ReactNode;
  error?: boolean | string;
}

export function TextInput({
  icon,
  error,
  className = "",
  ...props
}: TextInputProps) {
  const hasError = Boolean(error);
  const borderClass = hasError
    ? "border-[#F16B75]/60 focus:border-[#F16B75] focus:ring-[#F16B75]/25"
    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]";

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as LucideIcon;
    return <IconComp className="h-4 w-4" />;
  };

  return (
    <div className="relative flex items-center">
      {icon && (
        <span className="pointer-events-none absolute left-3.5 text-[var(--text-muted)] flex items-center">
          {renderIcon()}
        </span>
      )}
      <input
        className={`h-10 ${icon ? "pl-10 pr-3.5" : "px-3.5"} ${BASE_INPUT_CLASSES} ${borderClass} ${className}`}
        {...props}
      />
    </div>
  );
}

export interface TextareaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean | string;
  monospace?: boolean;
}

export function TextareaInput({
  error,
  monospace = false,
  rows = 4,
  className = "",
  ...props
}: TextareaInputProps) {
  const hasError = Boolean(error);
  const borderClass = hasError
    ? "border-[#F16B75]/60 focus:border-[#F16B75] focus:ring-[#F16B75]/25"
    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]";

  return (
    <textarea
      rows={rows}
      className={`py-3 px-3.5 leading-relaxed min-h-[90px] ${
        monospace ? "font-mono text-[12.5px]" : ""
      } ${BASE_INPUT_CLASSES} ${borderClass} ${className}`}
      {...props}
    />
  );
}

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean | string;
}

export function SelectInput({
  error,
  className = "",
  children,
  ...props
}: SelectInputProps) {
  const hasError = Boolean(error);
  const borderClass = hasError
    ? "border-[#F16B75]/60 focus:border-[#F16B75] focus:ring-[#F16B75]/25"
    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]";

  return (
    <div className="relative flex items-center">
      <select
        className={`h-10 pl-3.5 pr-9 appearance-none cursor-pointer ${BASE_INPUT_CLASSES} ${borderClass} ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--text-muted)]" />
    </div>
  );
}

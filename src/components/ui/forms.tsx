"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

import styles from "./forms.module.css";

type FieldChromeProps = {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  htmlFor: string;
  children: ReactNode;
};

function FieldChrome({
  label,
  description,
  error,
  required,
  htmlFor,
  children,
}: FieldChromeProps) {
  const hintId = description ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true"> *</span>
        ) : null}
      </label>
      {description ? (
        <p className={styles.hint} id={hintId}>
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className={styles.errorText} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({
  label,
  description,
  error,
  prefix,
  suffix,
  id,
  className,
  required,
  disabled,
  readOnly,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [description ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <FieldChrome
      label={label}
      description={description}
      error={error}
      required={required}
      htmlFor={inputId}
    >
      <div
        className={cn(
          styles.control,
          error && styles.controlError,
          disabled && styles.controlDisabled,
          className,
        )}
      >
        {prefix}
        <input
          id={inputId}
          className={styles.input}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {suffix}
      </div>
    </FieldChrome>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  description?: string;
  error?: string;
};

export function Textarea({
  label,
  description,
  error,
  id,
  className,
  required,
  disabled,
  readOnly,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [description ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <FieldChrome
      label={label}
      description={description}
      error={error}
      required={required}
      htmlFor={inputId}
    >
      <div
        className={cn(
          styles.control,
          error && styles.controlError,
          disabled && styles.controlDisabled,
          className,
        )}
      >
        <textarea
          id={inputId}
          className={styles.textarea}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
    </FieldChrome>
  );
}

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hideLabel?: boolean;
  loading?: boolean;
  onClear?: () => void;
};

export function SearchField({
  label,
  hideLabel = false,
  loading = false,
  onClear,
  id,
  value,
  disabled,
  className,
  ...rest
}: SearchFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasValue = String(value ?? "").length > 0;

  return (
    <div className={styles.field}>
      {hideLabel ? (
        <label className={styles.srOnly} htmlFor={inputId}>
          {label}
        </label>
      ) : (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div
        className={cn(
          styles.control,
          disabled && styles.controlDisabled,
          className,
        )}
      >
        <span aria-hidden="true">⌕</span>
        <input
          id={inputId}
          type="search"
          className={styles.input}
          value={value}
          disabled={disabled}
          aria-busy={loading || undefined}
          {...rest}
        />
        {loading ? <span aria-hidden="true">…</span> : null}
        {hasValue && onClear ? (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClear}
            aria-label="Очистить поиск"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}

export type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  description?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
};

export function NativeSelect({
  label,
  description,
  error,
  options,
  id,
  className,
  required,
  disabled,
  ...rest
}: NativeSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = [description ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <FieldChrome
      label={label}
      description={description}
      error={error}
      required={required}
      htmlFor={inputId}
    >
      <div
        className={cn(
          styles.control,
          error && styles.controlError,
          disabled && styles.controlDisabled,
          className,
        )}
      >
        <select
          id={inputId}
          className={styles.select}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </FieldChrome>
  );
}

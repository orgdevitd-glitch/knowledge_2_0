"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import styles from "./forms.module.css";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  description?: string;
  error?: string;
  indeterminate?: boolean;
};

export function Checkbox({
  label,
  description,
  error,
  indeterminate = false,
  id,
  className,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={styles.field}>
      <div className={styles.checkboxRow}>
        <input
          id={inputId}
          type="checkbox"
          className={cn(styles.checkbox, className)}
          ref={(node) => {
            if (node) node.indeterminate = indeterminate;
          }}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        <div>
          <label className={styles.label} htmlFor={inputId}>
            {label}
          </label>
          {description ? <p className={styles.hint}>{description}</p> : null}
          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type RadioGroupProps = {
  name: string;
  legend: string;
  description?: string;
  error?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function RadioGroup({
  name,
  legend,
  description,
  error,
  options,
  value,
  onChange,
  disabled,
}: RadioGroupProps) {
  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend className={styles.label}>{legend}</legend>
      {description ? <p className={styles.hint}>{description}</p> : null}
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        return (
          <div key={opt.value} className={styles.radioRow}>
            <input
              id={id}
              className={styles.radio}
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={opt.disabled || disabled}
              onChange={() => onChange?.(opt.value)}
            />
            <div>
              <label className={styles.label} htmlFor={id}>
                {opt.label}
              </label>
              {opt.description ? (
                <p className={styles.hint}>{opt.description}</p>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export type SwitchProps = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
};

export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;

  return (
    <div className={styles.switchRow}>
      <button
        id={switchId}
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
      />
      <div>
        <label className={styles.label} htmlFor={switchId}>
          {label}
        </label>
        {description ? <p className={styles.hint}>{description}</p> : null}
      </div>
    </div>
  );
}

export type { ReactNode };

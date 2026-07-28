"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const CONTROL = cn(
  "w-full rounded-control bg-background text-foreground",
  "border border-input px-3 py-2 text-sm",
  "placeholder:text-subtle-foreground",
  "transition-colors duration-150",
  "hover:border-border-strong focus:border-primary focus:outline-none",
  "disabled:opacity-60 disabled:cursor-not-allowed"
);

const INVALID = "border-danger hover:border-danger focus:border-danger";

/**
 * Wraps a control with its label, hint and error, wiring up htmlFor,
 * aria-describedby and aria-invalid. The old forms used bare <label> tags with
 * no association at all, so clicking a label did nothing and screen readers
 * announced the inputs unnamed.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  labelSuffix,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  labelSuffix?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={htmlFor}
            className="text-sm font-medium text-foreground"
          >
            {label}
            {required && (
              <span className="text-danger ml-0.5" aria-hidden>
                *
              </span>
            )}
          </label>
          {labelSuffix}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface BaseFieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
  labelSuffix?: ReactNode;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & BaseFieldProps
>(function Input(
  { label, hint, error, className, containerClassName, labelSuffix, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = `${inputId}-help`;

  const control = (
    <input
      ref={ref}
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={hint || error ? describedBy : undefined}
      className={cn(CONTROL, error && INVALID, className)}
      {...props}
    />
  );

  if (!label && !hint && !error) return control;
  return (
    <Field
      label={label}
      hint={hint && <span id={describedBy}>{hint}</span>}
      error={error && <span id={describedBy}>{error}</span>}
      required={props.required}
      htmlFor={inputId}
      className={containerClassName}
      labelSuffix={labelSuffix}
    >
      {control}
    </Field>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & BaseFieldProps
>(function Textarea(
  { label, hint, error, className, containerClassName, labelSuffix, id, rows = 4, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = `${inputId}-help`;

  const control = (
    <textarea
      ref={ref}
      id={inputId}
      rows={rows}
      aria-invalid={error ? true : undefined}
      aria-describedby={hint || error ? describedBy : undefined}
      className={cn(CONTROL, "resize-y min-h-20", error && INVALID, className)}
      {...props}
    />
  );

  if (!label && !hint && !error) return control;
  return (
    <Field
      label={label}
      hint={hint && <span id={describedBy}>{hint}</span>}
      error={error && <span id={describedBy}>{error}</span>}
      required={props.required}
      htmlFor={inputId}
      className={containerClassName}
      labelSuffix={labelSuffix}
    >
      {control}
    </Field>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & BaseFieldProps
>(function Select(
  { label, hint, error, className, containerClassName, id, children, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const control = (
    <select
      ref={ref}
      id={inputId}
      aria-invalid={error ? true : undefined}
      className={cn(CONTROL, "cursor-pointer pr-8", error && INVALID, className)}
      {...props}
    >
      {children}
    </select>
  );

  if (!label && !hint && !error) return control;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      htmlFor={inputId}
      className={containerClassName}
    >
      {control}
    </Field>
  );
});

/**
 * Comma-separated text in, trimmed array out. Genres were previously stored by
 * splitting a raw string at submit time in each page that had the field.
 */
export function TagsInput({
  value,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> &
  BaseFieldProps & {
    value: string[];
    onChange: (next: string[]) => void;
  }) {
  return (
    <Input
      value={value.join(", ")}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        )
      }
      {...props}
    />
  );
}

/**
 * Multi-value picker: add via native select, remove via chips.
 * Values already selected (including legacy freeform ones) stay as chips;
 * only `options` appear in the add dropdown.
 */
export function MultiSelect({
  label,
  hint,
  error,
  containerClassName,
  labelSuffix,
  id,
  options,
  value,
  onChange,
  placeholder = "Add…",
  disabled,
  required,
}: BaseFieldProps & {
  id?: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = `${inputId}-help`;
  const selected = new Set(value);
  const available = options.filter((opt) => !selected.has(opt));

  const control = (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <span
              key={item}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-border",
                "bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground"
              )}
            >
              {item}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== item))}
                className={cn(
                  "ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center",
                  "rounded-full text-muted-foreground hover:bg-background hover:text-foreground",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        id={inputId}
        disabled={disabled || available.length === 0}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? describedBy : undefined}
        className={cn(CONTROL, "cursor-pointer pr-8", error && INVALID)}
        value=""
        onChange={(e) => {
          const next = e.target.value;
          if (!next || selected.has(next)) return;
          onChange([...value, next]);
        }}
      >
        <option value="">
          {available.length === 0 ? "All options selected" : placeholder}
        </option>
        {available.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );

  if (!label && !hint && !error) return control;
  return (
    <Field
      label={label}
      hint={hint && <span id={describedBy}>{hint}</span>}
      error={error && <span id={describedBy}>{error}</span>}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
      labelSuffix={labelSuffix}
    >
      {control}
    </Field>
  );
}

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

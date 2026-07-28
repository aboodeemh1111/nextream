"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { FaSpinner } from "react-icons/fa";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-card",
  secondary:
    "bg-surface-2 text-foreground border border-border hover:bg-muted hover:border-border-strong",
  ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
  outline:
    "border border-border-strong text-foreground hover:bg-surface-2 hover:border-primary",
  danger: "bg-danger text-white hover:brightness-110",
  link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-base gap-2",
  icon: "h-9 w-9 p-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * `loading` disables the button and swaps the leading icon for a spinner while
 * keeping the label, so the control never changes width mid-request and the
 * user can still read what they clicked.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "secondary",
    size = "md",
    loading = false,
    icon,
    iconRight,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-medium whitespace-nowrap",
        "transition-colors duration-150",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <FaSpinner className="animate-spin shrink-0" aria-hidden />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
      {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
});

const ICON_SIZES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9",
  lg: "h-10 w-10 text-base",
} as const;

/** Icon-only button. Requires a label, because a glyph is not an accessible name. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "size" | "children"> & {
    label: string;
    children: ReactNode;
    size?: keyof typeof ICON_SIZES;
  }
>(function IconButton({ label, className, children, size = "md", ...props }, ref) {
  return (
    <Button
      ref={ref}
      size="icon"
      aria-label={label}
      title={label}
      className={cn("shrink-0", ICON_SIZES[size], className)}
      {...props}
    >
      {children}
    </Button>
  );
});

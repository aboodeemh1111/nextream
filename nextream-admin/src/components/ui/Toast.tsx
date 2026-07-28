"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds. Errors default to staying until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: ReactNode; accent: string }> = {
  success: { icon: <FaCheckCircle />, accent: "text-success" },
  error: { icon: <FaTimesCircle />, accent: "text-danger" },
  warning: { icon: <FaExclamationTriangle />, accent: "text-warning" },
  info: { icon: <FaInfoCircle />, accent: "text-info" },
};

/**
 * A queue with a provider, replacing the single `useState<{msg}>` each page
 * carried — which could only ever show one message and lost it on navigation.
 * Errors persist until dismissed, because the failure they describe usually
 * needs a decision.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  useEffect(() => setMounted(true), []);
  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const tone = options.tone ?? "info";
      const duration = options.duration ?? (tone === "error" ? 0 : 4000);

      setToasts((prev) => [...prev.slice(-4), { ...options, tone, id }]);
      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: "success" }),
      error: (title, description) => toast({ title, description, tone: "error" }),
      info: (title, description) => toast({ title, description, tone: "info" }),
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
            role="region"
            aria-label="Notifications"
          >
            {toasts.map((item) => (
              <div
                key={item.id}
                role={item.tone === "error" ? "alert" : "status"}
                aria-live={item.tone === "error" ? "assertive" : "polite"}
                className={cn(
                  "flex items-start gap-3 rounded-card border border-border",
                  "bg-popover text-popover-foreground p-3 shadow-overlay animate-in-up"
                )}
              >
                <span className={cn("mt-0.5 shrink-0", TONE_STYLES[item.tone!].accent)} aria-hidden>
                  {TONE_STYLES[item.tone!].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground break-words">
                      {item.description}
                    </p>
                  )}
                  {item.action && (
                    <button
                      type="button"
                      onClick={() => {
                        item.action!.onClick();
                        dismiss(item.id);
                      }}
                      className="mt-2 text-xs font-medium text-primary hover:underline"
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}

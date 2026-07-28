"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Field";

export interface ConfirmRequest {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  /**
   * When set, the confirm button stays disabled until the user types this
   * exact text. Reserved for deletes that take other records with them.
   */
  requireTyped?: string;
}

/**
 * Replaces window.confirm(), which blocked the tab, could not be styled, and
 * gave the same one-line warning whether the user was unpublishing an episode
 * or deleting a show with five seasons under it.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const confirm = useCallback((next: ConfirmRequest) => {
    setRequest(next);
    setTyped("");
    return new Promise<boolean>((resolve) => setResolver(() => resolve));
  }, []);

  const settle = useCallback(
    (ok: boolean) => {
      resolver?.(ok);
      setResolver(null);
      setRequest(null);
      setTyped("");
      setBusy(false);
    },
    [resolver]
  );

  const blocked =
    !!request?.requireTyped && typed.trim() !== request.requireTyped.trim();

  const dialog = request ? (
    <Dialog
      open
      onClose={() => settle(false)}
      title={request.title}
      size="sm"
      dismissOnBackdrop={!request.requireTyped}
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)} disabled={busy}>
            {request.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={request.tone === "danger" ? "danger" : "primary"}
            disabled={blocked}
            loading={busy}
            onClick={() => {
              setBusy(true);
              settle(true);
            }}
          >
            {request.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {request.description && (
        <div className="text-sm text-muted-foreground">{request.description}</div>
      )}
      {request.requireTyped && (
        <div className="mt-4">
          <Input
            label={
              <>
                Type <span className="font-mono text-foreground">{request.requireTyped}</span> to
                confirm
              </>
            }
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      )}
    </Dialog>
  ) : null;

  return { confirm, confirmDialog: dialog };
}

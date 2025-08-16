"use client";

import { ReactNode, useEffect } from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
};

export default function Modal({ open, title, children, onClose, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-950 border border-gray-800 rounded-lg w-[90vw] max-w-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold text-gray-100">{title}</div>
          <button className="text-gray-400 hover:text-white" onClick={onClose}>Close</button>
        </div>
        <div>{children}</div>
        {footer && (
          <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}



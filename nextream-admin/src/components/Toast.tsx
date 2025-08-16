"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  type?: 'success'|'error'|'info';
  onClose: () => void;
  durationMs?: number;
};

export default function Toast({ message, type='info', onClose, durationMs=2500 }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  const color = type==='success' ? 'bg-green-600' : type==='error' ? 'bg-red-600' : 'bg-gray-700';

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded text-white shadow-md ${color}`}>{message}</div>
  );
}



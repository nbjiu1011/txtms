"use client";

import { useEffect } from "react";
import { create } from "zustand";
import styles from "./overlay.module.css";

export const TOAST_DURATION_MS = 2800;

interface ToastState {
  message: string | null;
  /** Increments on every toast so the same text restarts the timer. */
  seq: number;
  show: (message: string) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  dismiss: () => set({ message: null }),
}));

/** Shows a single toast (replaces the current one) for 2.8s. */
export function toast(message: string): void {
  useToastStore.getState().show(message);
}

/** `.toast[role=status]` — bottom-center, one at a time. Mounted once in the root layout. */
export function Toaster() {
  const message = useToastStore((s) => s.message);
  const seq = useToastStore((s) => s.seq);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(dismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message, seq, dismiss]);

  if (!message) return null;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}

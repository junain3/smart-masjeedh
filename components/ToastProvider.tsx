"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
};

type ConfirmState = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (v: boolean) => void;
};

type ToastContextValue = {
  toast: (opts: { kind?: ToastKind; title?: string; message: string }) => void;
  confirm: (opts: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useAppToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useAppToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, message: "" });

  const toast = useCallback((opts: { kind?: ToastKind; title?: string; message: string }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: ToastItem = {
      id,
      kind: opts.kind || "info",
      title: opts.title,
      message: opts.message,
    };

    setItems((prev) => [next, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const confirm = useCallback(
    (opts: {
      title?: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
    }) => {
      return new Promise<boolean>((resolve) => {
        setConfirmState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText,
          cancelText: opts.cancelText,
          resolve,
        });
      });
    },
    []
  );

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const closeConfirm = (v: boolean) => {
    const r = confirmState.resolve;
    setConfirmState({ open: false, message: "" });
    r?.(v);
  };

  return (
    <ToastContext.Provider value={value}>
      {props.children}

      <div className="fixed top-4 right-4 z-[100] w-[min(420px,calc(100vw-2rem))] space-y-3">
        {items.map((t) => {
          const palette =
            t.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : t.kind === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-neutral-200 bg-white text-neutral-900";
          const sub =
            t.kind === "success"
              ? "text-emerald-700"
              : t.kind === "error"
              ? "text-red-700"
              : "text-neutral-600";

          return (
            <div key={t.id} className={`app-card p-4 border ${palette}`}>
              {t.title ? <p className="text-xs font-black tracking-widest uppercase">{t.title}</p> : null}
              <p className={`text-sm font-bold ${t.title ? "mt-1" : ""} ${sub}`}>{t.message}</p>
            </div>
          );
        })}
      </div>

      {confirmState.open ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => closeConfirm(false)} />
          <div className="relative w-full max-w-md app-card p-6">
            <p className="text-xs font-black tracking-widest uppercase text-neutral-600">
              {confirmState.title || "Confirm"}
            </p>
            <p className="mt-2 text-sm font-bold text-neutral-900">{confirmState.message}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="app-btn app-btn-soft w-full py-4" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText || "Cancel"}
              </button>
              <button className="app-btn app-btn-primary w-full py-4" onClick={() => closeConfirm(true)}>
                {confirmState.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

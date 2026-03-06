"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  containerId: string;
  onClose: () => void;
  onDecodedText: (decodedText: string) => void;
  helperText?: string;
  fps?: number;
  qrboxSize?: number;
};

function normalizeDecoded(decoded: any): string {
  if (typeof decoded === "string") return decoded;
  return (
    (decoded?.decodedText as string | undefined) ||
    (decoded?.text as string | undefined) ||
    String(decoded ?? "")
  );
}

export function QrScannerModal({
  open,
  title,
  containerId,
  onClose,
  onDecodedText,
  helperText,
  fps = 15,
  qrboxSize = 260,
}: Props) {
  const scannerRef = useRef<any>(null);
  const startingRef = useRef(false);
  const [ready, setReady] = useState(false);

  const permissionKey = useMemo(() => "camera_permission_granted", []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function ensureCameraPermissionOnce() {
      try {
        const granted = localStorage.getItem(permissionKey) === "1";
        if (granted) return;
        if (!navigator?.mediaDevices?.getUserMedia) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        } as any);

        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}

        localStorage.setItem(permissionKey, "1");
      } catch {
        // ignore: html5-qrcode will trigger prompt if needed
      }
    }

    async function start() {
      if (startingRef.current) return;
      startingRef.current = true;
      setReady(false);

      await ensureCameraPermissionOnce();

      try {
        const lib: any = await import("html5-qrcode");
        if (cancelled) return;

        const Html5Qrcode = lib.Html5Qrcode;
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(containerId);
        }

        const config = {
          fps,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1.0,
          disableFlip: true,
        };

        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          (decoded: any) => {
            const text = normalizeDecoded(decoded);
            if (text) onDecodedText(text);
          },
          () => {}
        );

        if (!cancelled) setReady(true);
      } catch {
        // ignore
      } finally {
        startingRef.current = false;
      }
    }

    start();

    return () => {
      cancelled = true;
      setReady(false);
      startingRef.current = false;

      const inst = scannerRef.current;
      if (inst?.stop) {
        try {
          inst.stop().then(() => inst.clear?.()).catch(() => {});
        } catch {}
      }
    };
  }, [open, containerId, fps, qrboxSize, onDecodedText, permissionKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      <header className="p-6 flex items-center justify-between text-white">
        <h2 className="text-xl font-black uppercase tracking-widest">{title}</h2>
        <button onClick={onClose} className="p-3 bg-white/10 rounded-3xl">
          <X className="w-6 h-6" />
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div
          id={containerId}
          className="w-full max-w-sm rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"
        />
        <p className="mt-8 text-white/60 text-sm font-bold uppercase tracking-widest text-center">
          {helperText || "Align QR Code within the frame to scan"}
        </p>
        {!ready ? (
          <p className="mt-3 text-white/40 text-[10px] font-bold uppercase tracking-widest">Starting camera…</p>
        ) : null}
      </div>
    </div>
  );
}

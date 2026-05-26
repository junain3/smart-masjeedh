"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, RefreshCw } from "lucide-react";

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
  fps = 30,
  qrboxSize = 280,
}: Props) {
  const scannerRef = useRef<any>(null);
  const startingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissionKey = useMemo(() => "camera_permission_granted", []);

  const startScanner = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setReady(false);
    setError(null);

    try {
      const lib: any = await import("html5-qrcode");
      if (!open) return;

      const Html5Qrcode = lib.Html5Qrcode;
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      } else {
        // Try to stop existing scanner before restarting
        try {
          await scannerRef.current.stop();
        } catch {}
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

      setReady(true);
    } catch (err: any) {
      console.error("QR scanner error:", err);
      if (err?.name === "NotAllowedError" || err?.message?.includes("Permission denied")) {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err?.name === "AbortError" || err?.message?.includes("already in use")) {
        setError("Camera is already in use. Close other apps using the camera.");
      } else {
        setError("Failed to start camera. Please try again.");
      }
    } finally {
      startingRef.current = false;
    }
  };

  const stopScanner = async () => {
    const inst = scannerRef.current;
    if (inst?.stop) {
      try {
        await inst.stop();
        await inst.clear?.();
      } catch {}
    }
    scannerRef.current = null;
    setReady(false);
    setError(null);
  };

  useEffect(() => {
    if (!open) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [open, containerId, fps, qrboxSize, onDecodedText]);

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
          className="w-[65%] max-w-[320px] min-w-[280px] rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"
        />
        
        {error ? (
          <div className="mt-8 w-full max-w-sm bg-rose-500/20 border border-rose-500/40 rounded-2xl p-4">
            <p className="text-rose-200 text-sm font-bold mb-4">{error}</p>
            <button
              onClick={startScanner}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <RefreshCw className="h-5 w-5" />
              Restart Camera
            </button>
          </div>
        ) : (
          <>
            <p className="mt-8 text-white/60 text-sm font-bold uppercase tracking-widest text-center">
              {helperText || "Align QR Code within the frame to scan"}
            </p>
            {!ready ? (
              <p className="mt-3 text-white/40 text-[10px] font-bold uppercase tracking-widest">Starting camera…</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

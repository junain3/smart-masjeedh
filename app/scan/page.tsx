"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DirectScanPage() {
  const router = useRouter();

  useEffect(() => {
    let scanner: any = null;
    let cancelled = false;
    import("html5-qrcode").then((lib) => {
      if (cancelled) return;
      scanner = new lib.Html5QrcodeScanner(
        "direct-reader",
        {
          fps: 12,
          qrbox: { width: 260, height: 260 },
          supportedScanTypes: [lib.Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true
        },
        false
      );
      scanner.render(
        (decodedText: string) => {
          if (decodedText.startsWith("smart-masjeedh:family:")) {
            const id = decodedText.split(":")[2];
            // Clear before navigate to free camera
            scanner.clear().then(() => router.replace(`/families/${id}`));
          }
        },
        () => {}
      );
    });
    return () => {
      cancelled = true;
      if (scanner) scanner.clear().catch(() => {});
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-4 text-center font-black tracking-widest uppercase text-xs opacity-80">
        Scan QR
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div id="direct-reader" className="w-full max-w-sm rounded-[2rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20" />
      </div>
    </div>
  );
}

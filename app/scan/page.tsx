"use client";

import { useRouter } from "next/navigation";
import { QrScannerModal } from "@/components/QrScannerModal";

export default function DirectScanPage() {
  const router = useRouter();

  const handleDecoded = (decodedText: string) => {
    if (decodedText.startsWith("smart-masjeedh:family:")) {
      const id = decodedText.split(":")[2];
      router.replace(`/families/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="p-4 text-center font-black tracking-widest uppercase text-xs opacity-80">
        Scan QR
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <QrScannerModal
          open
          title="Scan QR"
          containerId="direct-reader"
          onClose={() => router.replace("/")}
          onDecodedText={handleDecoded}
        />
      </div>
    </div>
  );
}

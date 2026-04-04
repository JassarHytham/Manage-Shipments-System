import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, CameraOff } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  active: boolean;
}

export default function BarcodeScanner({ onScan, active }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState("");
  const lastScanRef = useRef("");
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    if (!active) {
      // Stop scanning
      if (readerRef.current && videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const startScanning = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Prefer back camera
        const backCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );
        const deviceId = backCamera?.deviceId || devices[0]?.deviceId;

        if (!deviceId) {
          setError("لم يتم العثور على كاميرا");
          return;
        }

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (result) {
              const code = result.getText();
              const now = Date.now();
              // Debounce: prevent duplicate scans within 2 seconds
              if (
                code !== lastScanRef.current ||
                now - lastScanTimeRef.current > 2000
              ) {
                lastScanRef.current = code;
                lastScanTimeRef.current = now;
                onScan(code);
              }
            }
          }
        );
        setError("");
      } catch (err) {
        console.error("Scanner error:", err);
        setError("فشل في تشغيل الكاميرا. تأكد من منح صلاحية الكاميرا.");
      }
    };

    startScanning();

    return () => {
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [active, onScan]);

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <CameraOff className="w-10 h-10 mb-2" />
        <p className="text-sm">الكاميرا متوقفة</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      {error ? (
        <div className="flex flex-col items-center justify-center py-12 text-red-400">
          <CameraOff className="w-10 h-10 mb-2" />
          <p className="text-sm text-center px-4">{error}</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            className="w-full aspect-[4/3] object-cover"
            muted
            playsInline
          />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-24 border-2 border-white/50 rounded-lg">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-0.5 bg-red-500 animate-pulse" />
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
            <Camera className="w-3 h-3" />
            وجّه الكاميرا نحو الباركود
          </div>
        </>
      )}
    </div>
  );
}

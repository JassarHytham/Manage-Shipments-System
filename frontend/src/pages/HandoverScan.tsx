import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  Keyboard,
  Camera,
  Package,
} from "lucide-react";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import BarcodeScanner from "@/components/BarcodeScanner";

interface ScannedItem {
  id: string;
  order_id: string;
  awb_number: string;
  customer_name: string | null;
  customer_city: string | null;
  total_amount: number | null;
}

export default function HandoverScan() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [scannerActive, setScannerActive] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [count, setCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [courierCount, setCourierCount] = useState("");
  const [notes, setNotes] = useState("");
  const [batchCourier, setBatchCourier] = useState("");

  // Load existing batch data
  useEffect(() => {
    const loadBatch = async () => {
      try {
        const res = await api.get(`/handover/batch/${batchId}`);
        setBatchCourier(res.data.courier);
        setCount(res.data.your_count);
        if (res.data.items) {
          setScannedItems(
            res.data.items.map((item: ScannedItem) => ({
              id: item.id,
              order_id: item.order_id,
              awb_number: item.awb_number,
              customer_name: item.customer_name,
              customer_city: item.customer_city,
              total_amount: item.total_amount,
            }))
          );
        }
      } catch {
        navigate("/handover");
      }
    };
    loadBatch();
  }, [batchId, navigate]);

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const res = await api.post(`/handover/batch/${batchId}/scan`, {
          awb_number: code,
        });
        setLastMessage({
          text: res.data.message,
          success: res.data.success,
        });
        setCount(res.data.your_count);

        if (res.data.success && res.data.item) {
          setScannedItems((prev) => [res.data.item, ...prev]);
        }

        // Clear message after 3 seconds
        setTimeout(() => setLastMessage(null), 3000);
      } catch (err) {
        console.error("Scan error:", err);
        setLastMessage({ text: "خطأ في الاتصال", success: false });
        setTimeout(() => setLastMessage(null), 3000);
      }
    },
    [batchId]
  );

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput("");
    }
  };

  const handleConfirm = async () => {
    const courierCountNum = parseInt(courierCount);
    if (isNaN(courierCountNum) || courierCountNum < 0) return;

    try {
      await api.post(`/handover/batch/${batchId}/confirm`, {
        courier_count: courierCountNum,
        notes: notes || null,
      });
      navigate(`/handover/${batchId}`);
    } catch (err) {
      console.error(err);
    }
  };

  const courierLabel = batchCourier === "aramex" ? "أرامكس" : "SMSA";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/handover")}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>
        <h1 className="text-lg font-bold text-slate-800">
          مسح شحنات {courierLabel}
        </h1>
      </div>

      {/* Count banner */}
      <div className="bg-indigo-600 text-white rounded-xl p-4 text-center">
        <p className="text-3xl font-bold">{count}</p>
        <p className="text-sm text-indigo-200">شحنة تم مسحها</p>
      </div>

      {/* Scan status message */}
      {lastMessage && (
        <div
          className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
            lastMessage.success
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {lastMessage.success ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{lastMessage.text}</span>
        </div>
      )}

      {/* Scanner / Manual toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setManualMode(false);
            setScannerActive(true);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
            !manualMode
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <Camera className="w-4 h-4" />
          كاميرا
        </button>
        <button
          onClick={() => {
            setManualMode(true);
            setScannerActive(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
            manualMode
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <Keyboard className="w-4 h-4" />
          إدخال يدوي
        </button>
      </div>

      {/* Camera scanner */}
      {!manualMode && <BarcodeScanner onScan={handleScan} active={scannerActive} />}

      {/* Manual input */}
      {manualMode && (
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            placeholder="أدخل رقم البوليصة..."
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            dir="ltr"
            autoFocus
          />
          <button
            onClick={handleManualSubmit}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
          >
            إضافة
          </button>
        </div>
      )}

      {/* Confirm handover button */}
      {count > 0 && !showConfirm && (
        <button
          onClick={() => {
            setScannerActive(false);
            setShowConfirm(true);
          }}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
        >
          تأكيد التسليم ({count} شحنة)
        </button>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="bg-white rounded-xl border-2 border-green-200 p-4 space-y-3">
          <h3 className="font-semibold text-slate-800 text-right">
            تأكيد التسليم
          </h3>
          <p className="text-sm text-slate-500 text-right">
            أنت سلّمت <strong>{count}</strong> شحنة. كم عدد الشحنات التي أكدها
            المندوب؟
          </p>
          <input
            type="number"
            value={courierCount}
            onChange={(e) => setCourierCount(e.target.value)}
            placeholder="عدد المندوب"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
            dir="ltr"
            min="0"
            autoFocus
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات (اختياري)..."
            className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowConfirm(false);
                setScannerActive(true);
              }}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!courierCount}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              تأكيد
            </button>
          </div>
        </div>
      )}

      {/* Scanned items list */}
      {scannedItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-500">
            الشحنات المسجلة:
          </h3>
          {scannedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between"
            >
              <span className="text-sm text-slate-400" dir="ltr">
                {item.awb_number}
              </span>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {item.customer_name || "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.customer_city}
                    {item.total_amount !== null &&
                      ` • ${formatCurrency(item.total_amount)}`}
                  </p>
                </div>
                <Package className="w-4 h-4 text-green-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

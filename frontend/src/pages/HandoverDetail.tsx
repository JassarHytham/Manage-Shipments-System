import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
} from "lucide-react";
import api from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";

interface BatchDetail {
  id: string;
  courier: string;
  handed_by_name: string | null;
  handover_time: string;
  your_count: number;
  courier_count: number | null;
  status: string;
  notes: string | null;
  mismatch: boolean;
  items: Array<{
    id: string;
    awb_number: string;
    customer_name: string | null;
    customer_city: string | null;
    total_amount: number | null;
    scanned_at: string;
  }>;
}

export default function HandoverDetail() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatch = async () => {
      try {
        const res = await api.get(`/handover/batch/${batchId}`);
        setBatch(res.data);
      } catch {
        navigate("/handover");
      } finally {
        setLoading(false);
      }
    };
    fetchBatch();
  }, [batchId, navigate]);

  const handleResolve = async () => {
    try {
      await api.patch(`/handover/batch/${batchId}/resolve`);
      // Reload
      const res = await api.get(`/handover/batch/${batchId}`);
      setBatch(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!batch) return null;

  const courierLabel = batch.courier === "aramex" ? "أرامكس" : "SMSA";
  const isDisputed = batch.status === "disputed";
  const isConfirmed = batch.status === "confirmed";

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("/handover")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>

      {/* Status card */}
      <div
        className={`rounded-xl border-2 p-4 ${
          isDisputed
            ? "bg-red-50 border-red-200"
            : isConfirmed
            ? "bg-green-50 border-green-200"
            : "bg-yellow-50 border-yellow-200"
        }`}
      >
        <div className="flex items-center gap-2 justify-end mb-3">
          {isDisputed ? (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          ) : isConfirmed ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Clock className="w-5 h-5 text-yellow-600" />
          )}
          <h2 className="text-lg font-bold text-slate-800">
            دفعة {courierLabel}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-white/60 rounded-lg p-3">
            <p className="text-2xl font-bold text-slate-800">
              {batch.your_count}
            </p>
            <p className="text-xs text-slate-500">عددك</p>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <p
              className={`text-2xl font-bold ${
                batch.mismatch ? "text-red-600" : "text-slate-800"
              }`}
            >
              {batch.courier_count ?? "—"}
            </p>
            <p className="text-xs text-slate-500">عدد المندوب</p>
          </div>
        </div>

        {batch.mismatch && (
          <p className="text-sm text-red-600 font-medium text-center mt-3">
            يوجد فرق {Math.abs((batch.courier_count ?? 0) - batch.your_count)}{" "}
            شحنة
          </p>
        )}

        {batch.notes && (
          <div className="mt-3 p-2 bg-white/60 rounded-lg text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">ملاحظات:</p>
            <p className="whitespace-pre-wrap">{batch.notes}</p>
          </div>
        )}

        <div className="text-sm text-slate-500 mt-3 flex items-center gap-3 justify-end">
          {batch.handed_by_name && <span>{batch.handed_by_name}</span>}
          <span>{formatDate(batch.handover_time)}</span>
        </div>
      </div>

      {/* Resolve dispute button */}
      {isDisputed && (
        <button
          onClick={handleResolve}
          className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
        >
          حل النزاع وتأكيد الدفعة
        </button>
      )}

      {/* Items list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-500">
          الشحنات ({batch.items.length}):
        </h3>
        {batch.items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between"
          >
            <span className="text-xs text-slate-400" dir="ltr">
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
              <Package className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

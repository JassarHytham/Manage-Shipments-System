import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface Batch {
  id: string;
  courier: string;
  handed_by_name: string | null;
  handover_time: string;
  your_count: number;
  courier_count: number | null;
  status: string;
  mismatch: boolean;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  confirmed: {
    label: "مؤكد",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
  disputed: {
    label: "متنازع",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
  pending: {
    label: "بانتظار التأكيد",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    icon: Clock,
  },
};

const courierMap: Record<string, string> = {
  aramex: "أرامكس",
  smsa: "SMSA",
};

export default function Handover() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBatch, setShowNewBatch] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get("/handover/batches", {
        params: { per_page: 50 },
      });
      setBatches(res.data.batches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const createBatch = async (courier: string) => {
    try {
      const res = await api.post("/handover/batch", { courier });
      navigate(`/handover/${res.data.id}/scan`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">تسليم الشحنات</h1>
        <button
          onClick={() => setShowNewBatch(!showNewBatch)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          دفعة جديدة
        </button>
      </div>

      {/* New batch selection */}
      {showNewBatch && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-600">
            اختر شركة الشحن:
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => createBatch("aramex")}
              className="flex-1 py-3 bg-orange-50 border-2 border-orange-200 rounded-xl text-orange-700 font-semibold hover:bg-orange-100 transition-colors"
            >
              أرامكس
            </button>
            <button
              onClick={() => createBatch("smsa")}
              className="flex-1 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-700 font-semibold hover:bg-blue-100 transition-colors"
            >
              SMSA
            </button>
          </div>
        </div>
      )}

      {/* Batches list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p>لا توجد دفعات تسليم</p>
          <p className="text-sm mt-1">
            اضغط "دفعة جديدة" للبدء
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map((batch) => {
            const config = statusConfig[batch.status] || statusConfig.pending;
            const Icon = config.icon;
            return (
              <button
                key={batch.id}
                onClick={() =>
                  batch.status === "pending"
                    ? navigate(`/handover/${batch.id}/scan`)
                    : navigate(`/handover/${batch.id}`)
                }
                className={`w-full bg-white rounded-xl border p-4 text-right hover:shadow-sm transition-all ${
                  batch.mismatch
                    ? "border-red-200"
                    : "border-slate-200 hover:border-indigo-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <ChevronLeft className="w-5 h-5 text-slate-300 mt-0.5" />
                  <div className="flex-1 mr-0 ml-2">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium border ${config.color}`}
                      >
                        <span className="flex items-center gap-1">
                          {config.label}
                          <Icon className="w-3 h-3" />
                        </span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        {courierMap[batch.courier] || batch.courier}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm justify-end mt-2">
                      <span className="text-slate-400">
                        {formatDate(batch.handover_time)}
                      </span>
                      {batch.handed_by_name && (
                        <span className="text-slate-500">
                          {batch.handed_by_name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm justify-end mt-2 pt-2 border-t border-slate-100">
                      {batch.courier_count !== null && (
                        <span
                          className={
                            batch.mismatch
                              ? "text-red-600 font-medium"
                              : "text-green-600"
                          }
                        >
                          عدد المندوب: {batch.courier_count}
                        </span>
                      )}
                      <span className="text-slate-700 font-medium">
                        عددك: {batch.your_count}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Truck,
  Undo2,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";

interface AnalyticsData {
  period: string;
  orders: {
    total: number;
    pending: number;
    shipped: number;
    delivered: number;
    returned: number;
    cancelled: number;
  };
  return_rate: number;
  couriers: {
    aramex: number;
    smsa: number;
    unassigned: number;
  };
  handover: {
    total: number;
    confirmed: number;
    disputed: number;
    pending: number;
  };
  returns: {
    total: number;
    pending: number;
    completed: number;
  };
}

const periods = [
  { value: "today", label: "اليوم" },
  { value: "week", label: "الأسبوع" },
  { value: "month", label: "الشهر" },
  { value: "all", label: "الكل" },
];

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/analytics", { params: { period } });
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const courierTotal = data.couriers.aramex + data.couriers.smsa;
  const aramexPct = courierTotal > 0 ? Math.round((data.couriers.aramex / courierTotal) * 100) : 0;
  const smsaPct = courierTotal > 0 ? 100 - aramexPct : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">الإحصائيات</h1>

      {/* Period selector */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === p.value
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Package className="w-5 h-5 text-indigo-500" />}
          label="إجمالي الطلبات"
          value={data.orders.total}
          bg="bg-indigo-50"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          label="تم التوصيل"
          value={data.orders.delivered}
          bg="bg-green-50"
        />
        <StatCard
          icon={<Truck className="w-5 h-5 text-blue-500" />}
          label="تم الشحن"
          value={data.orders.shipped}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-yellow-500" />}
          label="قيد الانتظار"
          value={data.orders.pending}
          bg="bg-yellow-50"
        />
        <StatCard
          icon={<Undo2 className="w-5 h-5 text-red-500" />}
          label="مرتجعات"
          value={data.orders.returned}
          bg="bg-red-50"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
          label="نسبة الإرجاع"
          value={`${data.return_rate}%`}
          bg="bg-orange-50"
        />
      </div>

      {/* Courier breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">توزيع شركات الشحن</h3>

        {courierTotal === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">لا توجد شحنات</p>
        ) : (
          <>
            {/* Progress bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 mb-3">
              {aramexPct > 0 && (
                <div
                  className="bg-orange-500 transition-all duration-500"
                  style={{ width: `${aramexPct}%` }}
                />
              )}
              {smsaPct > 0 && (
                <div
                  className="bg-blue-500 transition-all duration-500"
                  style={{ width: `${smsaPct}%` }}
                />
              )}
            </div>

            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-slate-600">أرامكس</span>
                <span className="font-semibold text-slate-800">{data.couriers.aramex}</span>
                <span className="text-slate-400">({aramexPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-slate-600" dir="ltr">SMSA</span>
                <span className="font-semibold text-slate-800">{data.couriers.smsa}</span>
                <span className="text-slate-400">({smsaPct}%)</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Handover stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">دفعات التسليم</h3>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat
            label="مؤكدة"
            value={data.handover.confirmed}
            color="text-green-600"
          />
          <MiniStat
            label="متنازع عليها"
            value={data.handover.disputed}
            color="text-red-600"
            icon={data.handover.disputed > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : undefined}
          />
          <MiniStat
            label="معلقة"
            value={data.handover.pending}
            color="text-yellow-600"
          />
        </div>
      </div>

      {/* Returns stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3">المرتجعات</h3>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="إجمالي" value={data.returns.total} color="text-slate-700" />
          <MiniStat label="قيد المعالجة" value={data.returns.pending} color="text-yellow-600" />
          <MiniStat label="مكتملة" value={data.returns.completed} color="text-green-600" />
        </div>
      </div>

      {/* Cancelled */}
      {data.orders.cancelled > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 p-4">
          <XCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div className="flex-1 text-right">
            <p className="text-sm text-slate-500">طلبات ملغية</p>
          </div>
          <span className="font-semibold text-slate-700">{data.orders.cancelled}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4`}>
      <div className="flex items-center justify-end gap-2 mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800 text-right" dir="ltr">
        {value}
      </p>
      <p className="text-sm text-slate-500 text-right">{label}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color} flex items-center justify-center gap-1`}>
        {icon}
        {value}
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

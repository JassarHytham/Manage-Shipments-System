import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, Search } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface ReturnItem {
  id: string;
  return_type: string;
  status: string;
  customer_name: string | null;
  salla_order_id: string | null;
  return_reason: string | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المعالجة", color: "bg-yellow-100 text-yellow-800" },
  replacement_shipped: { label: "تم شحن البديل", color: "bg-blue-100 text-blue-800" },
  refunded: { label: "تم الاسترجاع", color: "bg-purple-100 text-purple-800" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800" },
};

const typeMap: Record<string, string> = {
  replacement_same: "استبدال نفس المنتج",
  replacement_different_size: "استبدال مقاس مختلف",
  refund: "استرجاع مبلغ",
};

export default function Returns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: "50" };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/returns", { params });
      setReturns(res.data.returns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, [search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">المرتجعات</h1>
        <button
          onClick={() => navigate("/returns/new")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          مرتجع جديد
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الطلب..."
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
        >
          <option value="">كل الحالات</option>
          <option value="pending">قيد المعالجة</option>
          <option value="replacement_shipped">تم شحن البديل</option>
          <option value="refunded">تم الاسترجاع</option>
          <option value="completed">مكتمل</option>
        </select>
      </div>

      {/* Returns list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p>لا توجد مرتجعات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {returns.map((ret) => {
            const st = statusMap[ret.status] || statusMap.pending;
            return (
              <button
                key={ret.id}
                onClick={() => navigate(`/returns/${ret.id}`)}
                className="w-full bg-white rounded-xl border border-slate-200 p-4 text-right hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <ChevronLeft className="w-5 h-5 text-slate-300 mt-0.5" />
                  <div className="flex-1 mr-0 ml-2">
                    <div className="flex items-center gap-2 justify-end mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {ret.customer_name || "عميل"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 justify-end">
                      <span className="text-slate-400">
                        {formatDate(ret.created_at)}
                      </span>
                      <span>{typeMap[ret.return_type] || ret.return_type}</span>
                      {ret.salla_order_id && (
                        <span dir="ltr">#{ret.salla_order_id}</span>
                      )}
                    </div>
                    {ret.return_reason && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {ret.return_reason}
                      </p>
                    )}
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

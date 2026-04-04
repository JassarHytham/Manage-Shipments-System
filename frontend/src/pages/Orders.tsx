import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, RefreshCw, ChevronLeft } from "lucide-react";
import api from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Order {
  id: string;
  salla_order_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  total_amount: number;
  status: string;
  courier: string | null;
  awb_number: string | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800" },
  shipped: { label: "تم الشحن", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-800" },
  returned: { label: "مرتجع", color: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغي", color: "bg-slate-100 text-slate-800" },
};

const courierMap: Record<string, string> = {
  aramex: "أرامكس",
  smsa: "SMSA",
};

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courierFilter, setCourierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (courierFilter) params.courier = courierFilter;

      const res = await api.get("/orders", { params });
      setOrders(res.data.orders);
      setTotal(res.data.total);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, courierFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSync = async () => {
    try {
      await api.post("/orders/sync");
      await fetchOrders();
    } catch (err) {
      console.error("Sync failed:", err);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">الطلبات</h1>
        <button
          onClick={handleSync}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          مزامنة
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="بحث بالاسم، الهاتف، أو رقم الطلب..."
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-xl border transition-colors ${
            showFilters || statusFilter || courierFilter
              ? "bg-indigo-50 border-indigo-200 text-indigo-600"
              : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          >
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="shipped">تم الشحن</option>
            <option value="delivered">تم التوصيل</option>
            <option value="returned">مرتجع</option>
            <option value="cancelled">ملغي</option>
          </select>
          <select
            value={courierFilter}
            onChange={(e) => {
              setCourierFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
          >
            <option value="">كل الشركات</option>
            <option value="aramex">أرامكس</option>
            <option value="smsa">SMSA</option>
          </select>
        </div>
      )}

      {/* Stats bar */}
      <div className="text-sm text-slate-500">
        {total} طلب{total !== 1 ? "" : ""}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p>لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const status = statusMap[order.status] || statusMap.pending;
            return (
              <button
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="w-full bg-white rounded-xl border border-slate-200 p-4 text-right hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <ChevronLeft className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 mr-0 ml-2">
                    <div className="flex items-center gap-2 justify-end flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {order.customer_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1 justify-end">
                      {order.salla_order_id && (
                        <span dir="ltr">#{order.salla_order_id}</span>
                      )}
                      <span>{order.customer_city}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2 mt-2">
                  <span className="text-slate-400">{formatDate(order.created_at)}</span>
                  <div className="flex items-center gap-3">
                    {order.courier && (
                      <span className="text-slate-500">
                        {courierMap[order.courier] || order.courier}
                      </span>
                    )}
                    <span className="font-medium text-slate-700">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-50"
          >
            السابق
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, User } from "lucide-react";
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
  created_at: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800" },
  shipped: { label: "تم الشحن", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-800" },
  returned: { label: "مرتجع", color: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغي", color: "bg-slate-100 text-slate-800" },
};

export default function CustomerLookup() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.get("/orders", {
        params: { search: query.trim(), per_page: 50 },
      });
      setResults(res.data.orders);
      setSearched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group orders by customer
  const customerGroups = results.reduce<
    Record<string, { name: string; phone: string; city: string; orders: Order[] }>
  >((acc, order) => {
    const key = order.customer_phone || order.customer_name;
    if (!acc[key]) {
      acc[key] = {
        name: order.customer_name,
        phone: order.customer_phone,
        city: order.customer_city,
        orders: [],
      };
    }
    acc[key].orders.push(order);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">البحث عن عميل</h1>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="الاسم، رقم الهاتف، أو رقم الطلب..."
            className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          بحث
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : searched && Object.keys(customerGroups).length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p>لا توجد نتائج</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(customerGroups).map(([key, customer]) => (
            <div
              key={key}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Customer header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2 justify-end">
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">
                      {customer.name}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-slate-500 justify-end mt-0.5">
                      <span>{customer.city}</span>
                      <span dir="ltr">{customer.phone}</span>
                    </div>
                  </div>
                  <User className="w-8 h-8 text-slate-300 bg-slate-200 rounded-full p-1.5" />
                </div>
                <p className="text-xs text-slate-400 mt-1 text-right">
                  {customer.orders.length} طلب
                </p>
              </div>

              {/* Customer orders */}
              <div className="divide-y divide-slate-100">
                {customer.orders.map((order) => {
                  const status =
                    statusMap[order.status] || statusMap.pending;
                  return (
                    <button
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-300" />
                      <div className="flex-1 flex items-center justify-end gap-3">
                        <span className="text-sm text-slate-400">
                          {formatDate(order.created_at)}
                        </span>
                        <span className="text-sm font-medium text-slate-700">
                          {formatCurrency(order.total_amount)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                        {order.salla_order_id && (
                          <span className="text-sm text-slate-600" dir="ltr">
                            #{order.salla_order_id}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

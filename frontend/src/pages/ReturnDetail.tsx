import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Package,
  Truck,
  RefreshCw,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";

interface ReturnData {
  id: string;
  return_type: string;
  return_reason: string | null;
  returned_items: Array<{ sku: string; size?: string; quantity: number }>;
  replacement_items: Array<{ sku: string; new_size: string; quantity: number }> | null;
  refund_amount: number | null;
  status: string;
  salla_synced: boolean;
  created_at: string;
  returned_by_name: string | null;
  original_order: {
    id: string;
    salla_order_id: string | null;
    customer_name: string;
    customer_phone: string;
    customer_city: string;
    total_amount: number;
    courier: string | null;
    awb_number: string | null;
    items: Array<{
      product_name: string;
      sku: string;
      size: string | null;
      quantity: number;
      unit_price: number;
    }>;
  } | null;
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

export default function ReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ret, setRet] = useState<ReturnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const fetchReturn = async () => {
    try {
      const res = await api.get(`/returns/${id}`);
      setRet(res.data);
    } catch {
      navigate("/returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturn();
  }, [id]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await api.post(`/returns/${id}/${action}`);
      await fetchReturn();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!ret) return null;

  const st = statusMap[ret.status] || statusMap.pending;
  const order = ret.original_order;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("/returns")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>

      {/* Status + type */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${st.color}`}>
            {st.label}
          </span>
          <h2 className="text-lg font-bold text-slate-800">
            {typeMap[ret.return_type]}
          </h2>
        </div>

        {order && (
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{order.customer_phone}</span>
              <span className="font-medium text-slate-700">
                {order.customer_name}
              </span>
            </div>
            {order.salla_order_id && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">رقم الطلب</span>
                <span className="text-slate-700" dir="ltr">
                  #{order.salla_order_id}
                </span>
              </div>
            )}
          </div>
        )}

        {ret.return_reason && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-600">
            <span className="font-medium">السبب:</span> {ret.return_reason}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-400">
          <span>{ret.returned_by_name}</span>
          <span>{formatDate(ret.created_at)}</span>
        </div>
      </div>

      {/* Returned items */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 justify-end">
          المنتجات المرتجعة
          <Package className="w-4 h-4 text-slate-400" />
        </h3>
        <div className="space-y-2">
          {ret.returned_items.map((item, i) => {
            // Find product name from order items
            const orderItem = order?.items.find(
              (oi) => oi.sku === item.sku
            );
            const replacement = ret.replacement_items?.find(
              (ri) => ri.sku === item.sku
            );
            return (
              <div
                key={i}
                className="p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">×{item.quantity}</span>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">
                      {orderItem?.product_name || item.sku}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 justify-end mt-0.5">
                      {item.size && (
                        <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          {item.size}
                        </span>
                      )}
                      {replacement?.new_size && (
                        <>
                          <span>←</span>
                          <span className="bg-green-100 text-green-600 px-1.5 py-0.5 rounded">
                            {replacement.new_size}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refund amount */}
      {ret.return_type === "refund" && ret.refund_amount !== null && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <p className="text-sm text-red-600 mb-1">مبلغ الاسترجاع</p>
          <p className="text-2xl font-bold text-red-700">
            {formatCurrency(ret.refund_amount)}
          </p>
        </div>
      )}

      {/* Salla sync status */}
      <div
        className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          ret.salla_synced
            ? "bg-green-50 text-green-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        <RefreshCw className="w-4 h-4" />
        <span>
          {ret.salla_synced
            ? "تم المزامنة مع سلة"
            : "لم تتم المزامنة مع سلة بعد"}
        </span>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        {ret.status === "pending" && ret.return_type !== "refund" && (
          <button
            onClick={() => handleAction("ship-replacement")}
            disabled={!!actionLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Truck className="w-4 h-4" />
            {actionLoading === "ship-replacement"
              ? "جارٍ التحديث..."
              : "شحن البديل"}
          </button>
        )}

        {ret.status === "pending" && ret.return_type === "refund" && (
          <button
            onClick={() => handleAction("refund")}
            disabled={!!actionLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            {actionLoading === "refund"
              ? "جارٍ التحديث..."
              : "تأكيد الاسترجاع"}
          </button>
        )}

        {(ret.status === "replacement_shipped" || ret.status === "refunded") && (
          <button
            onClick={() => handleAction("complete")}
            disabled={!!actionLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {actionLoading === "complete"
              ? "جارٍ التحديث..."
              : "إتمام المرتجع"}
          </button>
        )}

        {!ret.salla_synced && (
          <button
            onClick={() => handleAction("sync-salla")}
            disabled={!!actionLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            مزامنة مع سلة
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Package, Phone, MapPin, Truck, Hash, Navigation, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_name: string;
  sku: string;
  size: string | null;
  quantity: number;
  unit_price: number;
}

interface OrderDetail {
  id: string;
  salla_order_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  total_amount: number;
  status: string;
  courier: string | null;
  awb_number: string | null;
  salla_status: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

interface TrackingEvent {
  description: string;
  location?: string;
  datetime: string;
  code?: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800" },
  shipped: { label: "تم الشحن", color: "bg-blue-100 text-blue-800" },
  delivered: { label: "تم التوصيل", color: "bg-green-100 text-green-800" },
  returned: { label: "مرتجع", color: "bg-red-100 text-red-800" },
  cancelled: { label: "ملغي", color: "bg-slate-100 text-slate-800" },
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);

  const fetchTracking = async (awb: string) => {
    setTrackingLoading(true);
    try {
      const res = await api.get(`/courier/track/${awb}`);
      setTracking(res.data.tracking || []);
    } catch {
      setTracking([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data);
      } catch {
        navigate("/");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const status = statusMap[order.status] || statusMap.pending;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>

      {/* Order header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${status.color}`}>
            {status.label}
          </span>
          <h2 className="text-lg font-bold text-slate-800">
            {order.customer_name}
          </h2>
        </div>

        <div className="space-y-2 text-sm">
          {order.salla_order_id && (
            <div className="flex items-center gap-2 justify-end text-slate-600">
              <span dir="ltr">#{order.salla_order_id}</span>
              <Hash className="w-4 h-4 text-slate-400" />
            </div>
          )}
          <div className="flex items-center gap-2 justify-end text-slate-600">
            <span dir="ltr">{order.customer_phone}</span>
            <Phone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-2 justify-end text-slate-600">
            <span>{order.customer_city}</span>
            <MapPin className="w-4 h-4 text-slate-400" />
          </div>
          {order.courier && (
            <div className="flex items-center gap-2 justify-end text-slate-600">
              <span>
                {order.courier === "aramex" ? "أرامكس" : "SMSA"}
                {order.awb_number && (
                  <span className="text-slate-400 mr-1" dir="ltr">
                    ({order.awb_number})
                  </span>
                )}
              </span>
              <Truck className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>

        {/* Track shipment button */}
        {order.awb_number && order.courier && (
          <div className="mt-3">
            <button
              onClick={() => {
                if (!trackingOpen) {
                  fetchTracking(order.awb_number!);
                }
                setTrackingOpen(!trackingOpen);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              {trackingLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {trackingOpen ? "إخفاء التتبع" : "تتبع الشحنة"}
            </button>

            {trackingOpen && (
              <div className="mt-3 space-y-2">
                {trackingLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  </div>
                ) : tracking.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">
                    لا توجد بيانات تتبع
                  </p>
                ) : (
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    {tracking.map((event, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 text-sm ${
                          i !== tracking.length - 1 ? "border-b border-slate-100" : ""
                        } ${i === 0 ? "bg-indigo-50" : ""}`}
                      >
                        <div className="flex-1 text-right">
                          <p className={`font-medium ${i === 0 ? "text-indigo-700" : "text-slate-700"}`}>
                            {event.description}
                          </p>
                          <div className="flex items-center gap-2 justify-end mt-1 text-xs text-slate-400">
                            {event.location && <span>{event.location}</span>}
                            {event.datetime && <span dir="ltr">{event.datetime}</span>}
                          </div>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            i === 0 ? "bg-indigo-500" : "bg-slate-300"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="text-sm text-slate-400">
            {formatDate(order.created_at)}
          </span>
          <span className="text-lg font-bold text-slate-800">
            {formatCurrency(order.total_amount)}
          </span>
        </div>
      </div>

      {/* Order items */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 justify-end">
          المنتجات
          <Package className="w-4 h-4 text-slate-400" />
        </h3>
        {order.items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            لا توجد منتجات
          </p>
        ) : (
          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="text-sm text-slate-500">
                  {item.quantity} × {formatCurrency(item.unit_price)}
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-800">
                    {item.product_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 justify-end mt-0.5">
                    {item.size && (
                      <span className="bg-slate-200 px-1.5 py-0.5 rounded">
                        {item.size}
                      </span>
                    )}
                    <span dir="ltr">{item.sku}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

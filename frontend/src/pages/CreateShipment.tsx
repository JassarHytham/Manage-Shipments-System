import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Search,
  Truck,
  Check,
  Copy,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface Order {
  id: string;
  salla_order_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string | null;
  customer_district: string | null;
  customer_postal_code: string | null;
  total_amount: number;
  status: string;
  courier: string | null;
  awb_number: string | null;
}

interface CourierConfig {
  configured: boolean;
  label: string;
}

type Step = "search" | "details" | "result";

const statusAr: Record<string, string> = {
  pending: "قيد الانتظار",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  returned: "مرتجع",
  cancelled: "ملغي",
};

export default function CreateShipment() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("search");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Order[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected order + form
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courier, setCourier] = useState<"smsa" | "aramex">("smsa");
  const [shipmentType, setShipmentType] = useState<"send" | "return">("send");
  const [couriers, setCouriers] = useState<Record<string, CourierConfig>>({});

  // Consignee fields (editable, auto-filled from order)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Shipment details
  const [weight, setWeight] = useState("0.5");
  const [numPieces, setNumPieces] = useState("1");
  const [description, setDescription] = useState("شحنة");
  const [codAmount, setCodAmount] = useState("0");

  // Result
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    awb_number: string;
    label_url: string;
  } | null>(null);

  // Load courier config
  useEffect(() => {
    api
      .get("/shipments/config")
      .then((res) => setCouriers(res.data.couriers))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get("/orders", {
        params: { search: searchQuery.trim(), per_page: 20 },
      });
      setSearchResults(res.data.orders);
    } catch {
      setError("فشل في البحث");
    } finally {
      setSearching(false);
    }
  };

  const selectOrder = async (order: Order) => {
    setLoadingOrder(true);
    setError("");
    try {
      // Fetch fresh data from Salla (gets receiver address if available)
      const res = await api.post(`/orders/${order.id}/refresh-address`);
      const fresh: Order = res.data;
      setSelectedOrder(fresh);
      setName(fresh.customer_name);
      setPhone(fresh.customer_phone);
      setCity(fresh.customer_city);
      setAddress(fresh.customer_address || "");
      setDistrict(fresh.customer_district || "");
      setPostalCode(fresh.customer_postal_code || "");
      setCodAmount(String(fresh.total_amount));
    } catch {
      // Fall back to list data
      setSelectedOrder(order);
      setName(order.customer_name);
      setPhone(order.customer_phone);
      setCity(order.customer_city);
      setAddress(order.customer_address || "");
      setDistrict(order.customer_district || "");
      setPostalCode(order.customer_postal_code || "");
      setCodAmount(String(order.total_amount));
    } finally {
      setLoadingOrder(false);
    }
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!selectedOrder) return;
    if (!name || !phone || !city) {
      setError("الاسم والهاتف والمدينة مطلوبة");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const res = await api.post("/shipments/create", {
        order_id: selectedOrder.id,
        courier,
        shipment_type: shipmentType,
        consignee_name: name,
        consignee_phone: phone,
        consignee_city: city,
        consignee_address: address,
        consignee_district: district,
        consignee_postal_code: postalCode,
        weight: parseFloat(weight) || 0.5,
        num_pieces: parseInt(numPieces) || 1,
        description,
        cod_amount: parseFloat(codAmount) || 0,
      });

      if (res.data.success) {
        setResult({
          awb_number: res.data.awb_number,
          label_url: res.data.label_url || "",
        });
        setStep("result");
      } else {
        setError(res.data.error || "فشل في إنشاء الشحنة");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const copyAwb = () => {
    if (result?.awb_number) {
      navigator.clipboard.writeText(result.awb_number);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => {
          if (step === "search") navigate("/");
          else if (step === "details") setStep("search");
          else navigate("/");
        }}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2 justify-center">
        {["اختيار الطلب", "بيانات الشحنة", "النتيجة"].map((label, i) => {
          const steps: Step[] = ["search", "details", "result"];
          const isActive = steps.indexOf(step) >= i;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs ${
                  isActive ? "text-indigo-600 font-medium" : "text-slate-400"
                }`}
              >
                {label}
              </span>
              {i < 2 && <div className="w-6 h-px bg-slate-200" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Search */}
      {step === "search" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            ابحث عن الطلب
          </h2>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="اسم العميل، الهاتف، أو رقم الطلب..."
                className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              بحث
            </button>
          </div>

          {(searching || loadingOrder) ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              {loadingOrder && (
                <p className="text-sm text-slate-500">جاري جلب بيانات العميل...</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((order) => (
                <button
                  key={order.id}
                  onClick={() => selectOrder(order)}
                  className="w-full bg-white rounded-xl border border-slate-200 p-3 text-right hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm text-slate-500">
                        {formatCurrency(order.total_amount)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === "pending"
                            ? "bg-amber-50 text-amber-600"
                            : order.status === "shipped"
                            ? "bg-blue-50 text-blue-600"
                            : order.status === "delivered"
                            ? "bg-green-50 text-green-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {statusAr[order.status] || order.status}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-slate-400" dir="ltr">
                        {order.salla_order_id && `#${order.salla_order_id}`}{" "}
                        {order.customer_phone}
                      </p>
                      {order.customer_city && (
                        <p className="text-xs text-slate-400">
                          {order.customer_city}
                        </p>
                      )}
                    </div>
                  </div>
                  {order.awb_number && (
                    <div className="mt-1 text-xs text-slate-400 flex items-center gap-1 justify-end">
                      <Truck className="w-3 h-3" />
                      <span dir="ltr">{order.awb_number}</span>
                      <span>({order.courier})</span>
                    </div>
                  )}
                </button>
              ))}
              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-center text-sm text-slate-400 py-4">
                  لا توجد نتائج
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Shipment Details */}
      {step === "details" && selectedOrder && (
        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-slate-50 rounded-xl p-3 text-right">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {formatCurrency(selectedOrder.total_amount)}
              </span>
              <div>
                <p className="font-medium text-slate-800">
                  {selectedOrder.customer_name}
                </p>
                <p className="text-xs text-slate-400" dir="ltr">
                  {selectedOrder.salla_order_id &&
                    `#${selectedOrder.salla_order_id}`}
                </p>
              </div>
            </div>
          </div>

          {/* Courier selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              شركة الشحن
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["smsa", "aramex"] as const).map((c) => {
                const conf = couriers[c];
                const disabled = conf && !conf.configured;
                return (
                  <button
                    key={c}
                    onClick={() => !disabled && setCourier(c)}
                    disabled={disabled}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      courier === c
                        ? "border-indigo-500 bg-indigo-50"
                        : disabled
                        ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="font-bold text-slate-800">
                      {c === "smsa" ? "SMSA" : "Aramex"}
                    </p>
                    {disabled && (
                      <p className="text-xs text-red-400 mt-0.5">غير مفعّل</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shipment type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              نوع الشحنة
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "send", label: "إرسال" },
                  { value: "return", label: "مرتجع" },
                ] as const
              ).map((t) => (
                <button
                  key={t.value}
                  onClick={() => setShipmentType(t.value)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    shipmentType === t.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="font-medium text-slate-800">{t.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Consignee details */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {shipmentType === "send"
                ? "بيانات المستلم"
                : "بيانات المرسل (العميل)"}
            </h3>

            <div>
              <label className="block text-xs text-slate-500 mb-1">الاسم</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                رقم الجوال
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                dir="ltr"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  المدينة
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">الحي</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                العنوان
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="العنوان التفصيلي..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                الرمز البريدي
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                dir="ltr"
              />
            </div>
          </div>

          {/* Shipment details */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              تفاصيل الشحنة
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  الوزن (كجم)
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  عدد القطع
                </label>
                <input
                  type="number"
                  value={numPieces}
                  onChange={(e) => setNumPieces(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                الوصف
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">
                الدفع عند الاستلام (ر.س)
              </label>
              <input
                type="number"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري إنشاء البوليصة...
              </>
            ) : (
              <>
                <Truck className="w-5 h-5" />
                إنشاء بوليصة الشحن
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 3: Result */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="bg-green-50 rounded-2xl p-6 text-center space-y-3">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-green-800">
              تم إنشاء البوليصة بنجاح
            </h2>
            <p className="text-sm text-green-600">
              {courier === "smsa" ? "SMSA Express" : "Aramex"} —{" "}
              {shipmentType === "send" ? "إرسال" : "مرتجع"}
            </p>
          </div>

          {/* AWB Number */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-xs text-slate-500 mb-1">
              رقم البوليصة (AWB)
            </label>
            <div className="flex items-center gap-2">
              <span
                className="flex-1 text-xl font-mono font-bold text-slate-800 text-center"
                dir="ltr"
              >
                {result.awb_number}
              </span>
              <button
                onClick={copyAwb}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                title="نسخ"
              >
                <Copy className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Label link */}
          {result.label_url && (
            <a
              href={result.label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              فتح بوليصة الشحن (PDF)
            </a>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setStep("search");
                setSelectedOrder(null);
                setSearchQuery("");
                setSearchResults([]);
                setResult(null);
                setError("");
              }}
              className="py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              شحنة جديدة
            </button>
            <button
              onClick={() => navigate("/")}
              className="py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-900 transition-colors"
            >
              الرئيسية
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

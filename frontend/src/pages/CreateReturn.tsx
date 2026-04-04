import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Package, Check } from "lucide-react";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_name: string;
  sku: string;
  size: string | null;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  salla_order_id: string | null;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  items: OrderItem[];
}

interface SelectedItem {
  sku: string;
  size: string | null;
  quantity: number;
  product_name: string;
  new_size?: string;
}

type Step = "search" | "select_items" | "resolution" | "confirm";

export default function CreateReturn() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("search");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Order[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected order
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Selected items
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Resolution
  const [returnType, setReturnType] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get("/orders", {
        params: { search: searchQuery.trim(), per_page: 20 },
      });
      setSearchResults(res.data.orders);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const selectOrder = async (orderId: string) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setSelectedOrder(res.data);
      setStep("select_items");
    } catch (err) {
      console.error(err);
    }
  };

  const toggleItem = (item: OrderItem) => {
    const exists = selectedItems.find((s) => s.sku === item.sku && s.size === item.size);
    if (exists) {
      setSelectedItems((prev) =>
        prev.filter((s) => !(s.sku === item.sku && s.size === item.size))
      );
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          sku: item.sku,
          size: item.size,
          quantity: item.quantity,
          product_name: item.product_name,
        },
      ]);
    }
  };

  const updateItemQty = (sku: string, size: string | null, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((s) =>
        s.sku === sku && s.size === size ? { ...s, quantity: qty } : s
      )
    );
  };

  const updateNewSize = (sku: string, size: string | null, newSize: string) => {
    setSelectedItems((prev) =>
      prev.map((s) =>
        s.sku === sku && s.size === size ? { ...s, new_size: newSize } : s
      )
    );
  };

  const handleSubmit = async () => {
    if (!selectedOrder || selectedItems.length === 0) return;
    setError("");
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        original_order_id: selectedOrder.id,
        return_type: returnType,
        return_reason: returnReason || null,
        returned_items: selectedItems.map((i) => ({
          sku: i.sku,
          size: i.size,
          quantity: i.quantity,
        })),
      };

      if (returnType === "replacement_different_size") {
        body.replacement_items = selectedItems
          .filter((i) => i.new_size)
          .map((i) => ({
            sku: i.sku,
            new_size: i.new_size,
            quantity: i.quantity,
          }));
      }

      if (returnType === "refund") {
        body.refund_amount = parseFloat(refundAmount);
      }

      const res = await api.post("/returns", body);
      navigate(`/returns/${res.data.id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => {
          if (step === "search") navigate("/returns");
          else if (step === "select_items") setStep("search");
          else if (step === "resolution") setStep("select_items");
          else if (step === "confirm") setStep("resolution");
        }}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowRight className="w-4 h-4" />
        رجوع
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2 justify-center">
        {["البحث", "المنتجات", "الحل", "تأكيد"].map((label, i) => {
          const steps: Step[] = ["search", "select_items", "resolution", "confirm"];
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
              {i < 3 && <div className="w-4 h-px bg-slate-200" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Search for order */}
      {step === "search" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">ابحث عن الطلب</h2>
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

          {searching ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((order) => (
                <button
                  key={order.id}
                  onClick={() => selectOrder(order.id)}
                  className="w-full bg-white rounded-xl border border-slate-200 p-3 text-right hover:border-indigo-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      {formatCurrency(order.total_amount)}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">
                        {order.customer_name}
                      </p>
                      <p className="text-xs text-slate-400" dir="ltr">
                        {order.salla_order_id && `#${order.salla_order_id}`}{" "}
                        {order.customer_phone}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Select returned items */}
      {step === "select_items" && selectedOrder && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 text-right">
            <p className="font-medium text-slate-800">
              {selectedOrder.customer_name}
            </p>
            <p className="text-xs text-slate-400" dir="ltr">
              #{selectedOrder.salla_order_id}
            </p>
          </div>

          <h2 className="text-lg font-semibold text-slate-800">
            اختر المنتجات المرتجعة
          </h2>

          <div className="space-y-2">
            {selectedOrder.items.map((item) => {
              const isSelected = selectedItems.some(
                (s) => s.sku === item.sku && s.size === item.size
              );
              const sel = selectedItems.find(
                (s) => s.sku === item.sku && s.size === item.size
              );
              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <button
                    onClick={() => toggleItem(item)}
                    className="w-full flex items-center justify-between"
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600"
                          : "border-slate-300"
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1 text-right mr-0 ml-3">
                      <p className="font-medium text-slate-800">
                        {item.product_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 justify-end mt-0.5">
                        <span>{formatCurrency(item.unit_price)}</span>
                        <span>×{item.quantity}</span>
                        {item.size && (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.size}
                          </span>
                        )}
                        <span dir="ltr">{item.sku}</span>
                      </div>
                    </div>
                    <Package className="w-5 h-5 text-slate-300" />
                  </button>

                  {isSelected && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 justify-end">
                      <span className="text-xs text-slate-500">الكمية:</span>
                      <input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={sel?.quantity || 1}
                        onChange={(e) =>
                          updateItemQty(
                            item.sku,
                            item.size,
                            parseInt(e.target.value) || 1
                          )
                        }
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center text-sm"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setStep("resolution")}
            disabled={selectedItems.length === 0}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            التالي — اختر الحل
          </button>
        </div>
      )}

      {/* STEP 3: Choose resolution */}
      {step === "resolution" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">اختر نوع الحل</h2>

          <div className="space-y-2">
            {[
              {
                value: "replacement_same",
                label: "استبدال نفس المنتج",
                desc: "إرسال نفس المنتج بنفس المقاس",
              },
              {
                value: "replacement_different_size",
                label: "استبدال مقاس مختلف",
                desc: "إرسال نفس المنتج بمقاس مختلف",
              },
              {
                value: "refund",
                label: "استرجاع مبلغ",
                desc: "إرجاع المبلغ للعميل",
              },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setReturnType(option.value)}
                className={`w-full p-4 rounded-xl border-2 text-right transition-all ${
                  returnType === option.value
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-800">{option.label}</p>
                <p className="text-sm text-slate-500 mt-0.5">{option.desc}</p>
              </button>
            ))}
          </div>

          {/* New size inputs for different size */}
          {returnType === "replacement_different_size" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-700">
                اختر المقاسات الجديدة:
              </h3>
              {selectedItems.map((item) => (
                <div
                  key={`${item.sku}-${item.size}`}
                  className="flex items-center gap-3 justify-end"
                >
                  <input
                    type="text"
                    value={item.new_size || ""}
                    onChange={(e) =>
                      updateNewSize(item.sku, item.size, e.target.value)
                    }
                    placeholder="المقاس الجديد"
                    className="w-32 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-center"
                  />
                  <span className="text-sm text-slate-500">←</span>
                  <span className="text-sm text-slate-700">
                    {item.product_name}
                    {item.size && (
                      <span className="text-slate-400 mr-1">({item.size})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Refund amount */}
          {returnType === "refund" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                مبلغ الاسترجاع (ر.س)
              </label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                dir="ltr"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              سبب الإرجاع (اختياري)
            </label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="مثال: العميل طلب مقاس أكبر..."
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2}
            />
          </div>

          <button
            onClick={() => setStep("confirm")}
            disabled={!returnType}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            التالي — مراجعة وتأكيد
          </button>
        </div>
      )}

      {/* STEP 4: Confirm */}
      {step === "confirm" && selectedOrder && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            مراجعة المرتجع
          </h2>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">العميل</span>
              <span className="font-medium text-slate-800">
                {selectedOrder.customer_name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">رقم الطلب</span>
              <span className="text-slate-700" dir="ltr">
                #{selectedOrder.salla_order_id}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">نوع الحل</span>
              <span className="font-medium text-slate-800">
                {returnType === "replacement_same" && "استبدال نفس المنتج"}
                {returnType === "replacement_different_size" &&
                  "استبدال مقاس مختلف"}
                {returnType === "refund" && "استرجاع مبلغ"}
              </span>
            </div>
            {returnType === "refund" && refundAmount && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">مبلغ الاسترجاع</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(parseFloat(refundAmount))}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              المنتجات المرتجعة:
            </h3>
            {selectedItems.map((item) => (
              <div
                key={`${item.sku}-${item.size}`}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <span className="text-sm text-slate-500">×{item.quantity}</span>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">
                    {item.product_name}
                  </p>
                  <div className="text-xs text-slate-400">
                    {item.size && <span>مقاس: {item.size}</span>}
                    {item.new_size && (
                      <span className="text-indigo-600 mr-2">
                        ← جديد: {item.new_size}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {returnReason && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
              <span className="font-medium">السبب:</span> {returnReason}
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "جارٍ الإرسال..." : "تأكيد المرتجع"}
          </button>
        </div>
      )}
    </div>
  );
}

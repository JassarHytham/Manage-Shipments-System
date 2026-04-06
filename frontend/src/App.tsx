import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import CustomerLookup from "@/pages/CustomerLookup";
import Handover from "@/pages/Handover";
import HandoverScan from "@/pages/HandoverScan";
import HandoverDetail from "@/pages/HandoverDetail";
import Returns from "@/pages/Returns";
import CreateReturn from "@/pages/CreateReturn";
import ReturnDetail from "@/pages/ReturnDetail";
import Analytics from "@/pages/Analytics";
import CreateShipment from "@/pages/CreateShipment";

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login onLogin={login} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={logout} />}>
          <Route path="/" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/handover/:batchId/scan" element={<HandoverScan />} />
          <Route path="/handover/:batchId" element={<HandoverDetail />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/returns/new" element={<CreateReturn />} />
          <Route path="/returns/:id" element={<ReturnDetail />} />
          <Route path="/shipment/new" element={<CreateShipment />} />
          <Route path="/lookup" element={<CustomerLookup />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

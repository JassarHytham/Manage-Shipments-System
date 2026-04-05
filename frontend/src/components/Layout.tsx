import { NavLink, Outlet } from "react-router-dom";
import {
  Package,
  Search,
  LogOut,
  LayoutDashboard,
  ScanBarcode,
  Undo2,
  BarChart3,
} from "lucide-react";

interface LayoutProps {
  user: { name: string; role: string };
  onLogout: () => void;
}

const roleMap: Record<string, string> = {
  admin: "مدير",
  operator: "مشغل",
};

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "الرئيسية" },
  { to: "/handover", icon: ScanBarcode, label: "تسليم الشحنات" },
  { to: "/returns", icon: Undo2, label: "المرتجعات" },
  { to: "/lookup", icon: Search, label: "بحث عميل" },
  { to: "/analytics", icon: BarChart3, label: "الإحصائيات" },
];

export default function Layout({ user, onLogout }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-dvh bg-slate-50">
      {/* Top bar */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-lg">Wakkiez</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className="text-sm text-slate-200 block leading-tight">{user.name}</span>
            <span className="text-xs text-slate-400">{roleMap[user.role] || user.role}</span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 pb-20 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom nav — mobile-friendly */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 z-50 safe-area-bottom">
        <div className="flex justify-around max-w-lg mx-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 px-2 min-w-[3.5rem] text-[11px] transition-colors ${
                  isActive
                    ? "text-indigo-600 font-semibold"
                    : "text-slate-400 active:text-slate-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-lg ${isActive ? "bg-indigo-50" : ""}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="mt-0.5">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, ShoppingBag, BarChart3, Settings, LogOut, Leaf } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

const NAV = [
  { href: "/seller/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/seller/products", label: "Products", icon: Package },
  { href: "/seller/orders", label: "Orders", icon: ShoppingBag },
  { href: "/seller/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/seller/settings", label: "Settings", icon: Settings },
];

export default function SellerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 hidden md:flex flex-col bg-primary text-primary-foreground min-h-screen fixed left-0 top-0 bottom-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6" />
            <span className="font-bold text-lg font-serif">InstaVEG</span>
          </div>
          <p className="text-white/60 text-xs mt-1">Seller Dashboard</p>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                location === href || location.startsWith(href + "/")
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}>
                <Icon className="w-5 h-5" />
                {label}
              </div>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-2 py-2 text-sm text-white/70 hover:text-white w-full"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/40 bg-primary z-50">
        <div className="flex items-center justify-around h-14">
          {NAV.slice(0, 4).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <div className={`flex flex-col items-center gap-0.5 px-3 ${
                location === href ? "text-white" : "text-white/60"
              }`}>
                <Icon className="w-5 h-5" />
                <span className="text-[9px]">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 md:ml-64 pb-16 md:pb-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}

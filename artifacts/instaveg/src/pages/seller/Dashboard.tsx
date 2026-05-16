import { Link } from "wouter";
import { useGetSellerStats, getGetSellerStatsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { TrendingUp, Package, ShoppingBag, Clock, AlertTriangle, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const { data: statsRaw, isLoading } = useGetSellerStats({ query: { queryKey: getGetSellerStatsQueryKey(), enabled: !!user } });
  const stats = statsRaw as any;

  const statCards = [
    { label: "Total Revenue", value: stats ? `₹${stats.totalRevenue?.toFixed(0)}` : null, icon: TrendingUp, color: "bg-green-50 text-green-700" },
    { label: "Total Orders", value: stats?.totalOrders, icon: ShoppingBag, color: "bg-blue-50 text-blue-700" },
    { label: "Products Listed", value: stats?.totalProducts, icon: Package, color: "bg-purple-50 text-purple-700" },
    { label: "Pending Orders", value: stats?.pendingOrders, icon: Clock, color: "bg-yellow-50 text-yellow-700" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back, {user?.name ?? "Seller"}</p>
        </div>
        <Link href="/seller/add-product">
          <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{card.value ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart */}
      {stats?.revenueByDay && stats.revenueByDay.length > 0 && (
        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-6 mb-6">
          <h3 className="font-semibold mb-4">Revenue (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v: number) => [`₹${v}`, "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="#31511E" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Alerts */}
      {stats?.lowStockProducts > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">{stats.lowStockProducts} products are low on stock. <Link href="/seller/products"><span className="font-semibold underline">Update inventory</span></Link></p>
        </div>
      )}
    </div>
  );
}

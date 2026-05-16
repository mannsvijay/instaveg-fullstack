import { useGetAdminStats, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Users, Store, Package, ShoppingBag, TrendingUp, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { data: statsRaw, isLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), enabled: !!user } });
  const stats = statsRaw as any;

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers, icon: Users, color: "bg-blue-50 text-blue-700" },
    { label: "Active Sellers", value: stats?.totalSellers, icon: Store, color: "bg-green-50 text-green-700" },
    { label: "Total Products", value: stats?.totalProducts, icon: Package, color: "bg-purple-50 text-purple-700" },
    { label: "Total Orders", value: stats?.totalOrders, icon: ShoppingBag, color: "bg-orange-50 text-orange-700" },
    { label: "Total Revenue", value: stats ? `₹${stats.totalRevenue?.toFixed(0)}` : null, icon: TrendingUp, color: "bg-emerald-50 text-emerald-700" },
    { label: "Pending Approvals", value: stats?.pendingSellerApprovals, icon: Clock, color: "bg-yellow-50 text-yellow-700" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="text-2xl font-bold">{card.value ?? 0}</p>
            )}
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {stats?.revenueByDay && (
        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 mb-6">
          <h3 className="font-semibold mb-4">Platform Revenue (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v: number) => [`₹${v}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#31511E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

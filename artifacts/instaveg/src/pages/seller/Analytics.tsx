import { useGetSellerStats, getGetSellerStatsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ["#31511E", "#859F3D", "#a3c45a", "#d4e8a0", "#f0f7cc"];

export default function SellerAnalytics() {
  const { user } = useAuthStore();
  const { data: statsRaw, isLoading } = useGetSellerStats({ query: { queryKey: getGetSellerStatsQueryKey(), enabled: !!user } });
  const stats = statsRaw as any;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-8">Analytics</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        {stats?.revenueByDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 col-span-2">
            <h3 className="font-semibold mb-4">Revenue — Last 7 Days</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v: number) => [`₹${v}`, "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#31511E" strokeWidth={2.5} dot={{ r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Orders by Status Pie */}
        {stats?.ordersByStatus && stats.ordersByStatus.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.2 } }} className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5">
            <h3 className="font-semibold mb-4">Orders by Status</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.ordersByStatus.map((_: any, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Summary Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }} className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5">
          <h3 className="font-semibold mb-4">Summary</h3>
          <div className="space-y-4">
            {[
              { label: "Total Revenue", value: `₹${stats?.totalRevenue?.toFixed(0) ?? 0}` },
              { label: "Recent Revenue (7d)", value: `₹${stats?.recentRevenue?.toFixed(0) ?? 0}` },
              { label: "Total Orders", value: stats?.totalOrders ?? 0 },
              { label: "Pending Orders", value: stats?.pendingOrders ?? 0 },
              { label: "Products Listed", value: stats?.totalProducts ?? 0 },
              { label: "Low Stock Products", value: stats?.lowStockProducts ?? 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="font-semibold text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

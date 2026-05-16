import { Link } from "wouter";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-orange-50 text-orange-700 border-orange-200",
  dispatched: "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function Orders() {
  const { user } = useAuthStore();
  const { data: ordersRaw, isLoading } = useListOrders({}, { query: { queryKey: getListOrdersQueryKey({}), enabled: !!user } });
  const orders = (ordersRaw as any[]) ?? [];

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <Package className="w-16 h-16 text-primary/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No orders yet</h2>
        <p className="text-muted-foreground mb-6">Sign in to view your order history</p>
        <Link href="/login"><Button className="rounded-xl px-8">Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-2xl font-bold font-serif mb-6">My Orders</h1>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl mb-4" />)
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-16 h-16 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No orders yet</p>
          <Link href="/category/all"><Button variant="outline" className="mt-4 rounded-xl">Start Shopping</Button></Link>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }}
          className="space-y-4"
        >
          {orders.map((order: any) => (
            <motion.div
              key={order.id}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            >
              <Link href={`/orders/${order.id}`}>
                <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">Order #{order.id}</span>
                      <Badge className={`text-[10px] px-2 py-0.5 ${STATUS_COLOR[order.status] ?? ""}`}>
                        {order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.items?.length ?? 0} items · ₹{order.total?.toFixed(0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

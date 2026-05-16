import { useGetSellerOrders, useUpdateOrderStatus, getGetSellerOrdersQueryKey, getGetSellerOrdersQueryKey as _gq } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, ChevronDown } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-orange-50 text-orange-700 border-orange-200",
  dispatched: "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "dispatched",
  dispatched: "delivered",
};

export default function SellerOrders() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ordersRaw, isLoading } = useGetSellerOrders({}, { query: { queryKey: getGetSellerOrdersQueryKey({}), enabled: !!user } });
  const orders = (ordersRaw as any[]) ?? [];

  const updateMutation = useUpdateOrderStatus();

  const advance = (id: number, current: string) => {
    const next = NEXT_STATUS[current];
    if (!next) return;
    updateMutation.mutate(
      { id, data: { status: next as any } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetSellerOrdersQueryKey({}) });
          toast({ title: `Order marked as ${next}` });
        },
      }
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-8">Orders</h1>

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl mb-4" />)
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Order #{order.id}</span>
                    <Badge className={`text-[10px] ${STATUS_COLOR[order.status] ?? ""}`}>{order.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">by {order.buyerName ?? "Customer"} · {new Date(order.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <span className="font-bold text-primary">₹{order.total?.toFixed(0)}</span>
              </div>

              <div className="text-xs text-muted-foreground mb-3">
                {(order.items ?? []).slice(0, 2).map((item: any) => (
                  <span key={item.id}>{item.productName} ×{item.quantity} · </span>
                ))}
                {order.items?.length > 2 && <span>+{order.items.length - 2} more</span>}
              </div>

              {NEXT_STATUS[order.status] && (
                <button
                  onClick={() => advance(order.id, order.status)}
                  disabled={updateMutation.isPending}
                  className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
                >
                  Mark as {NEXT_STATUS[order.status]} <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

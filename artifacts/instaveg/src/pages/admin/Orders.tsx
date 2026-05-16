import { useState } from "react";
import { useAdminListOrders, useUpdateOrderStatus, getAdminListOrdersQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-orange-50 text-orange-700 border-orange-200",
  dispatched: "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUSES = ["pending", "confirmed", "preparing", "dispatched", "delivered", "cancelled"];

export default function AdminOrders() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const adminOrderParams = { status, page };
  const { data: ordersRaw, isLoading } = useAdminListOrders(adminOrderParams, { query: { queryKey: getAdminListOrdersQueryKey(adminOrderParams), enabled: !!user } });
  const orders = (ordersRaw as any[]) ?? [];

  const updateMutation = useUpdateOrderStatus();

  const updateStatus = (id: number, s: string) => {
    updateMutation.mutate(
      { id, data: { status: s as any } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getAdminListOrdersQueryKey({}) });
          toast({ title: `Order updated to ${s}` });
        },
      }
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-6">All Orders</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {["", ...STATUSES].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s || (!status && s === "") ? "default" : "outline"}
            onClick={() => { setStatus(s || undefined); setPage(1); }}
            className="rounded-lg capitalize text-xs"
          >
            {s || "All"}
          </Button>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 m-4 rounded-xl" />)
        ) : orders.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-10 h-10 text-primary/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No orders found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {orders.map((order: any) => (
              <div key={order.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm">#{order.id}</span>
                    <Badge className={`text-[10px] ${STATUS_COLOR[order.status] ?? ""}`}>{order.status}</Badge>
                    <Badge className={order.paymentStatus === "paid" ? "bg-green-50 text-green-700 border-green-200 text-[10px]" : "bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]"}>
                      {order.paymentStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.buyerName ?? "Buyer"} · {order.sellerName ?? "Seller"} · ₹{order.total?.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  className="text-xs border border-border/40 rounded-lg px-2 py-1 bg-white/80 outline-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

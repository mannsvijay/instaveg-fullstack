import { useParams } from "wouter";
import { useGetOrder, useUpdateOrderStatus, getGetOrderQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Package, CheckCircle, Clock, Truck, Home, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

const STATUS_STEPS = ["pending", "confirmed", "preparing", "dispatched", "delivered"];
const STEP_ICONS = [Clock, CheckCircle, Package, Truck, Home];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  preparing: "bg-orange-50 text-orange-700 border-orange-200",
  dispatched: "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id ?? "0", 10);
  const { user } = useAuthStore();

  const { data: orderRaw, isLoading } = useGetOrder(orderId, { query: { queryKey: getGetOrderQueryKey(orderId), enabled: !!orderId } });
  const order = orderRaw as any;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-32 rounded-2xl mb-4" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!order) return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Order not found.</div>;

  const currentStep = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <button onClick={() => history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-serif">Order #{order.id}</h1>
        <Badge className={STATUS_COLOR[order.status] ?? ""}>
          {order.status}
        </Badge>
      </div>

      {/* Status Timeline */}
      {order.status !== "cancelled" && (
        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-6 mb-4">
          <h3 className="font-semibold mb-5">Order Progress</h3>
          <div className="relative">
            {/* Progress line */}
            <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-secondary" />
            <div
              className="absolute left-5 top-5 w-0.5 bg-primary transition-all duration-500"
              style={{ height: `${Math.max(0, currentStep) * (100 / (STATUS_STEPS.length - 1))}%` }}
            />
            <div className="space-y-6">
              {STATUS_STEPS.map((step, i) => {
                const Icon = STEP_ICONS[i];
                const isActive = i <= currentStep;
                return (
                  <div key={step} className="flex items-center gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isActive ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-secondary text-muted-foreground"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-medium capitalize text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {step}
                      </p>
                      {i === currentStep && order.eta && (
                        <p className="text-xs text-muted-foreground">ETA: {order.eta}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4 mb-4">
        <h3 className="font-semibold mb-4">Items Ordered</h3>
        <div className="space-y-3">
          {(order.items ?? []).map((item: any) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.productImage ? (
                <img src={item.productImage} alt={item.productName} className="w-12 h-12 rounded-xl object-cover bg-secondary" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary/30" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.quantity}x · per {item.productUnit}</p>
              </div>
              <span className="font-semibold text-sm text-primary">₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bill Summary */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4 mb-4">
        <h3 className="font-semibold mb-3">Bill Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{order.subtotal?.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>₹{order.deliveryFee?.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform fee</span>
            <span>₹{order.platformFee?.toFixed(0)}</span>
          </div>
          <div className="border-t border-border/20 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">₹{order.total?.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4">
        <h3 className="font-semibold mb-2">Payment</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground capitalize">{order.paymentMethod ?? "N/A"}</span>
          <Badge className={order.paymentStatus === "paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}>
            {order.paymentStatus}
          </Badge>
        </div>
      </div>
    </div>
  );
}

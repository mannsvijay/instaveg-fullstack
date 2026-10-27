import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCart,
  useListAddresses,
  useCreateOrder,
  getGetCartQueryKey,
  getListAddressesQueryKey,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, CreditCard, Wallet, CheckCircle, Loader2 } from "lucide-react";

export default function Checkout() {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cod">("cod");
  const [loading, setLoading] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<any[] | null>(null);

  const { data: cartRaw } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: !!user } });
  const cart = cartRaw as any;

  const { data: addressesRaw } = useListAddresses({ query: { queryKey: getListAddressesQueryKey(), enabled: !!user } });
  const addresses = (addressesRaw as any[]) ?? [];

  const createOrderMutation = useCreateOrder();

  const defaultAddress = addresses.find((a: any) => a.isDefault) ?? addresses[0];
  const activeAddress = selectedAddressId ?? defaultAddress?.id;

  const handlePlaceOrder = async () => {
    if (!activeAddress) {
      toast({ title: "Select a delivery address", variant: "destructive" });
      return;
    }
    setLoading(true);

    // COD only (C5). Checkout returns one order per seller (H7).
    createOrderMutation.mutate(
      { data: { addressId: activeAddress, paymentMethod, notes: "" } },
      {
        onSuccess: (orders) => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          setPlacedOrders(orders as any[]);
          setLoading(false);
        },
        onError: (err) => {
          setLoading(false);
          const apiMessage = (err as { data?: { error?: unknown } }).data?.error;
          toast({ title: "Failed to place order", description: typeof apiMessage === "string" ? apiMessage : undefined, variant: "destructive" });
        },
      }
    );
  };

  if (placedOrders) {
    const paid = placedOrders.reduce((sum, order) => sum + (order.total ?? 0), 0);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm w-full"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-serif mb-2">{placedOrders.length > 1 ? `${placedOrders.length} Orders Placed!` : "Order Placed!"}</h2>
          <p className="text-muted-foreground mb-6">
            {placedOrders.length > 1 ? "Your items come from different farms, so each one sends its own order." : "Your fresh vegetables are on their way."}
          </p>
          <div className="bg-white/70 rounded-2xl border border-border/30 p-4 mb-8 text-sm text-left space-y-2">
            {placedOrders.map((order) => (
              <div key={order.id} className="flex justify-between gap-3">
                <span className="text-muted-foreground truncate">#{order.id} · {order.sellerName ?? "Seller"}</span>
                <span>₹{Number(order.total).toFixed(0)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t border-border/20 pt-2">
              <span>Total (Cash on Delivery)</span>
              <span className="text-primary">₹{paid.toFixed(0)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={() => setLocation("/orders")} className="rounded-xl">Track Orders</Button>
            <Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl">Continue Shopping</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const items: any[] = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const deliveryFee = cart?.deliveryFee ?? 0;
  const platformFee = cart?.platformFee ?? 0;
  const total = cart?.total ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl pb-40">
      <h1 className="text-2xl font-bold font-serif mb-6">Checkout</h1>

      {/* Delivery Address */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4 mb-4">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" /> Delivery Address
        </h3>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No addresses saved. <a href="/profile" className="text-primary hover:underline">Add one</a></p>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr: any) => (
              <label key={addr.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                activeAddress === addr.id ? "border-primary bg-primary/5" : "border-border/30 hover:border-primary/30"
              }`}>
                <input
                  type="radio"
                  name="address"
                  className="mt-0.5 accent-primary"
                  checked={activeAddress === addr.id}
                  onChange={() => setSelectedAddressId(addr.id)}
                />
                <div>
                  <div className="font-medium text-sm">{addr.label}</div>
                  <div className="text-xs text-muted-foreground">{addr.street}, {addr.city}, {addr.state} - {addr.pincode}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4 mb-4">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-primary" /> Payment Method
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {[
            // COD-only (C5): Razorpay is hidden until real test-mode integration (H4).
            { value: "cod", label: "Cash on Delivery", icon: Wallet },
          ].map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-colors text-center ${
                paymentMethod === value ? "border-primary bg-primary/5" : "border-border/30 hover:border-primary/30"
              }`}
            >
              <input type="radio" name="payment" className="sr-only" checked={paymentMethod === value} onChange={() => setPaymentMethod(value as any)} />
              <Icon className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4 mb-4">
        <h3 className="font-semibold mb-3">Order Summary</h3>
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.productName} × {item.quantity}</span>
              <span>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border/20 mt-3 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>₹{deliveryFee}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span>₹{platformFee}</span></div>
          <div className="flex justify-between font-bold text-base mt-1 pt-1 border-t border-border/20">
            <span>Total</span><span className="text-primary">₹{total.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Place Order */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/40 p-4 z-40">
        <div className="container mx-auto max-w-2xl">
          <Button
            className="w-full h-12 rounded-xl font-semibold text-base"
            onClick={handlePlaceOrder}
            disabled={loading || items.length === 0}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Place Order — ₹${total.toFixed(0)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

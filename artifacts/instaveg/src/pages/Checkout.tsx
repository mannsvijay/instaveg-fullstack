import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetCart,
  useListAddresses,
  useCreateOrder,
  useCreatePayment,
  useVerifyPayment,
  getGetCartQueryKey,
  getListAddressesQueryKey,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, CreditCard, Wallet, CheckCircle, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("cod");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: cartRaw } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: !!user } });
  const cart = cartRaw as any;

  const { data: addressesRaw } = useListAddresses({ query: { queryKey: getListAddressesQueryKey(), enabled: !!user } });
  const addresses = (addressesRaw as any[]) ?? [];

  const createOrderMutation = useCreateOrder();
  const createPaymentMutation = useCreatePayment();
  const verifyPaymentMutation = useVerifyPayment();

  const defaultAddress = addresses.find((a: any) => a.isDefault) ?? addresses[0];
  const activeAddress = selectedAddressId ?? defaultAddress?.id;

  const handlePlaceOrder = async () => {
    if (!activeAddress) {
      toast({ title: "Select a delivery address", variant: "destructive" });
      return;
    }
    setLoading(true);

    createOrderMutation.mutate(
      { data: { addressId: activeAddress, paymentMethod, notes: "" } },
      {
        onSuccess: async (orderRaw: any) => {
          const order = orderRaw as any;

          if (paymentMethod === "cod") {
            qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
            setSuccess(true);
            setLoading(false);
            return;
          }

          // Razorpay flow
          createPaymentMutation.mutate(
            { id: order.id },
            {
              onSuccess: async (paymentData: any) => {
                const loaded = await loadRazorpay();
                if (!loaded) {
                  toast({ title: "Payment gateway unavailable", variant: "destructive" });
                  setLoading(false);
                  return;
                }

                const options = {
                  key: paymentData.keyId,
                  amount: paymentData.amount,
                  currency: paymentData.currency,
                  order_id: paymentData.razorpayOrderId,
                  name: "InstaVEG",
                  description: `Order #${order.id}`,
                  handler: (response: any) => {
                    verifyPaymentMutation.mutate(
                      {
                        id: order.id,
                        data: {
                          razorpayOrderId: response.razorpay_order_id,
                          razorpayPaymentId: response.razorpay_payment_id,
                          razorpaySignature: response.razorpay_signature,
                        },
                      },
                      {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
                          setSuccess(true);
                          setLoading(false);
                        },
                      }
                    );
                  },
                  modal: { ondismiss: () => setLoading(false) },
                  theme: { color: "#31511E" },
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
              },
              onError: () => { setLoading(false); toast({ title: "Payment initiation failed", variant: "destructive" }); },
            }
          );
        },
        onError: () => { setLoading(false); toast({ title: "Failed to place order", variant: "destructive" }); },
      }
    );
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold font-serif mb-2">Order Placed!</h2>
          <p className="text-muted-foreground mb-8">Your fresh vegetables are on their way. Expected delivery in 30 minutes.</p>
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
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "cod", label: "Cash on Delivery", icon: Wallet },
            { value: "razorpay", label: "Razorpay", icon: CreditCard },
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

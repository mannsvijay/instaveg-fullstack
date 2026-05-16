import { Link, useLocation } from "wouter";
import { useGetCart, useUpdateCartItem, useRemoveFromCart, useClearCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Trash2, Plus, Minus, Leaf, ArrowRight, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Cart() {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cartRaw, isLoading } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: !!user } });
  const cart = cartRaw as any;

  const updateMutation = useUpdateCartItem();
  const removeMutation = useRemoveFromCart();
  const clearMutation = useClearCart();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <ShoppingCart className="w-16 h-16 text-primary/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Sign in to view your cart and start shopping</p>
        <Link href="/login"><Button className="rounded-xl px-8">Sign In</Button></Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl mb-4" />)}
      </div>
    );
  }

  const items: any[] = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const deliveryFee = cart?.deliveryFee ?? 0;
  const total = cart?.total ?? 0;

  const updateQuantity = (productId: number, quantity: number) => {
    updateMutation.mutate(
      { productId, data: { quantity } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetCartQueryKey() }) }
    );
  };

  const removeItem = (productId: number) => {
    removeMutation.mutate(
      { productId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: "Item removed" });
        },
      }
    );
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <ShoppingCart className="w-16 h-16 text-primary/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add some fresh vegetables to get started</p>
        <Link href="/category/all"><Button className="rounded-xl px-8">Browse Products</Button></Link>
      </div>
    );
  }

  // Group by seller
  const grouped: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const key = item.sellerName ?? "Unknown Seller";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl pb-40">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-serif">My Cart</h1>
        <button
          onClick={() => clearMutation.mutate(undefined, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetCartQueryKey() }) })}
          className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1"
        >
          <Trash2 className="w-4 h-4" /> Clear all
        </button>
      </div>

      <AnimatePresence>
        {Object.entries(grouped).map(([sellerName, sellerItems]) => (
          <motion.div
            key={sellerName}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 shadow-sm mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/30 border-b border-border/20">
              <Leaf className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{sellerName}</span>
            </div>
            <div className="divide-y divide-border/20">
              {sellerItems.map((item: any) => (
                <motion.div key={item.productId} layout className="flex items-center gap-3 p-4">
                  {item.productImage ? (
                    <img src={item.productImage} alt={item.productName} className="w-16 h-16 rounded-xl object-cover bg-secondary" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center">
                      <Leaf className="w-6 h-6 text-primary/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.productId}`}>
                      <p className="font-medium text-sm line-clamp-1">{item.productName}</p>
                    </Link>
                    <p className="text-xs text-muted-foreground">per {item.productUnit}</p>
                    <p className="font-semibold text-primary text-sm mt-0.5">₹{(item.price * item.quantity).toFixed(0)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-colors"
                        disabled={item.quantity >= (item.stock ?? 99)}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Bill Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/40 p-4 z-40">
        <div className="container mx-auto max-w-2xl">
          <div className="bg-white/60 rounded-2xl p-4 mb-4 border border-border/30">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{subtotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>₹{deliveryFee}</span>
            </div>
            <div className="border-t border-border/20 mt-2 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">₹{total.toFixed(0)}</span>
            </div>
          </div>
          <Button className="w-full h-12 rounded-xl font-semibold text-base" onClick={() => setLocation("/checkout")}>
            Proceed to Checkout <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

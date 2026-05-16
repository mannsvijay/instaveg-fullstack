import { Link } from "wouter";
import { useGetWishlist, useRemoveFromWishlist, useAddToCart, getGetWishlistQueryKey, getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingCart, Leaf, Trash2 } from "lucide-react";

export default function Wishlist() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: wishlistRaw, isLoading } = useGetWishlist({ query: { queryKey: getGetWishlistQueryKey(), enabled: !!user } });
  const items = (wishlistRaw as any[]) ?? [];

  const removeFromWishlistMutation = useRemoveFromWishlist();
  const addToCartMutation = useAddToCart();

  const handleRemove = (productId: number) => {
    removeFromWishlistMutation.mutate({ productId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetWishlistQueryKey() });
        toast({ title: "Removed from wishlist" });
      },
    });
  };

  const handleAddToCart = (productId: number, name: string) => {
    addToCartMutation.mutate(
      { data: { productId, quantity: 1 } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: "Added to cart", description: name });
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <Heart className="w-16 h-16 text-primary/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Your wishlist is empty</h2>
        <Link href="/login"><Button className="rounded-xl px-8 mt-4">Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-2xl font-bold font-serif mb-6">My Wishlist</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nothing saved yet</p>
          <Link href="/category/all"><Button variant="outline" className="mt-4 rounded-xl">Explore Products</Button></Link>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-2 gap-4">
            {items.map((p: any) => {
              const image = Array.isArray(p.images) ? p.images[0] : null;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 shadow-sm overflow-hidden"
                >
                  <Link href={`/product/${p.id}`}>
                    <div className="h-40 bg-secondary/30 relative">
                      {image ? (
                        <img src={image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Leaf className="w-8 h-8 text-primary/30" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-1">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3">₹{p.price} / {p.unit}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-lg"
                        onClick={() => handleAddToCart(p.id, p.name)}
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                      <button
                        onClick={() => handleRemove(p.id)}
                        className="w-8 h-8 flex items-center justify-center bg-secondary/50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

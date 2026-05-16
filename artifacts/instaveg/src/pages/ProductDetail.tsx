import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetProduct, useGetProductReviews, useAddToCart, useAddToWishlist, useRemoveFromWishlist, useGetWishlist, getGetCartQueryKey, getGetWishlistQueryKey, getGetProductQueryKey, getGetProductReviewsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ShoppingCart, Heart, Star, Leaf, Minus, Plus, ArrowLeft, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const productId = parseInt(id ?? "0", 10);

  const { data: product, isLoading } = useGetProduct(productId, {
    query: { queryKey: getGetProductQueryKey(productId), enabled: !!productId },
  });
  const { data: reviews } = useGetProductReviews(productId, {
    query: { queryKey: getGetProductReviewsQueryKey(productId), enabled: !!productId },
  });
  const { data: wishlist } = useGetWishlist({
    query: { queryKey: getGetWishlistQueryKey(), enabled: !!user },
  });

  const addToCartMutation = useAddToCart();
  const addToWishlistMutation = useAddToWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();

  const isWishlisted = (wishlist as any[])?.some((p: any) => p.id === productId);

  const handleAddToCart = () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    addToCartMutation.mutate(
      { data: { productId, quantity } },
      {
        onSuccess: () => {
          setAddedToCart(true);
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: "Added to cart", description: `${quantity}x ${(product as any)?.name}` });
          setTimeout(() => setAddedToCart(false), 2000);
        },
        onError: () => toast({ title: "Failed to add to cart", variant: "destructive" }),
      }
    );
  };

  const toggleWishlist = () => {
    if (!user) { setLocation("/login"); return; }
    if (isWishlisted) {
      removeFromWishlistMutation.mutate({ productId }, {
        onSuccess: () => qc.invalidateQueries({ queryKey: getGetWishlistQueryKey() }),
      });
    } else {
      addToWishlistMutation.mutate({ productId }, {
        onSuccess: () => qc.invalidateQueries({ queryKey: getGetWishlistQueryKey() }),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-64 w-full rounded-2xl mb-6" />
        <Skeleton className="h-8 w-3/4 mb-3" />
        <Skeleton className="h-6 w-1/4 mb-6" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!product) return <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Product not found.</div>;

  const p = product as any;
  const image = Array.isArray(p.images) ? p.images[0] : p.images;
  const discount = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : null;

  return (
    <div className="pb-32">
      {/* Back */}
      <div className="container mx-auto px-4 pt-4">
        <button onClick={() => history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Image */}
      <div className="relative bg-white/60 mx-4 mt-4 rounded-2xl overflow-hidden h-64 md:h-96">
        {image ? (
          <img src={image} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <Leaf className="w-16 h-16 text-primary/30" />
          </div>
        )}
        {p.isOrganic && (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">Organic</Badge>
        )}
        {p.isFresh && (
          <Badge className="absolute top-3 right-12 bg-accent text-accent-foreground">Fresh</Badge>
        )}
        <button
          onClick={toggleWishlist}
          className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm"
        >
          <Heart className={`w-5 h-5 ${isWishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
        </button>
      </div>

      {/* Details */}
      <div className="container mx-auto px-4 mt-6 max-w-2xl">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl font-bold font-serif text-foreground flex-1 pr-4">{p.name}</h1>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">₹{p.price}</div>
            {p.mrp && p.mrp > p.price && (
              <div className="text-sm text-muted-foreground line-through">₹{p.mrp}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-muted-foreground">per {p.unit}</span>
          {discount && <Badge className="bg-green-50 text-green-700 border-green-200">{discount}% off</Badge>}
          {p.stock > 0 ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">In Stock ({p.stock} left)</Badge>
          ) : (
            <Badge variant="destructive">Out of Stock</Badge>
          )}
        </div>

        {p.rating > 0 && (
          <div className="flex items-center gap-1.5 mb-4">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-4 h-4 ${s <= Math.round(p.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <span className="text-sm font-medium">{p.rating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({p.reviewCount} reviews)</span>
          </div>
        )}

        {p.sellerName && (
          <div className="bg-secondary/50 rounded-xl p-3 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-medium text-sm">{p.sellerName}</div>
              {p.sellerCity && <div className="text-xs text-muted-foreground">{p.sellerCity}</div>}
            </div>
          </div>
        )}

        {p.description && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">{p.description}</p>
        )}

        {p.nutritionInfo && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Nutrition Info</h3>
            <p className="text-sm text-muted-foreground bg-secondary/30 rounded-xl p-3">{p.nutritionInfo}</p>
          </div>
        )}

        {Array.isArray(p.tags) && p.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {p.tags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Reviews */}
        {Array.isArray(reviews) && reviews.length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold mb-4">Customer Reviews</h3>
            <div className="space-y-3">
              {(reviews as any[]).slice(0, 5).map((review: any) => (
                <div key={review.id} className="bg-white/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                      {review.userName?.[0] ?? "U"}
                    </div>
                    <span className="text-sm font-medium">{review.userName ?? "User"}</span>
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Add to Cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border/40 p-4 z-40 md:bottom-0">
        <div className="container mx-auto max-w-2xl flex items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-1">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
            <Button
              className="w-full h-12 rounded-xl font-semibold text-base"
              onClick={handleAddToCart}
              disabled={p.stock === 0 || addToCartMutation.isPending}
            >
              {addedToCart ? (
                <><CheckCircle className="w-5 h-5 mr-2" />Added!</>
              ) : (
                <><ShoppingCart className="w-5 h-5 mr-2" />Add to Cart — ₹{(p.price * quantity).toFixed(0)}</>
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

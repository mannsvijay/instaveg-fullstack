import { Link } from "wouter";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useGetFreshPicks, useGetTrendingProducts, useListCategories,
  useAddToCart, getGetFreshPicksQueryKey, getGetTrendingProductsQueryKey,
  getListCategoriesQueryKey, getGetCartQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Leaf, ShoppingCart, Star, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-border/30">
      <Skeleton className="aspect-square w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-1/3 rounded-full" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-1/4 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 shrink-0">
      <Skeleton className="w-20 h-20 rounded-full" />
      <Skeleton className="h-3 w-16 rounded-full" />
    </div>
  );
}

export default function Home() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: freshPicksRaw, isLoading: loadingFresh } = useGetFreshPicks({}, { query: { queryKey: getGetFreshPicksQueryKey() } });
  const { data: trendingRaw, isLoading: loadingTrending } = useGetTrendingProducts({}, { query: { queryKey: getGetTrendingProductsQueryKey() } });
  const { data: categoriesRaw, isLoading: loadingCats } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  const freshPicks = (freshPicksRaw as any[]) ?? [];
  const trending = (trendingRaw as any[]) ?? [];
  const categories = (categoriesRaw as any[]) ?? [];

  const addToCartMutation = useAddToCart();
  const handleAddToCart = (productId: number, name: string) => {
    if (!user) { window.location.href = "/login"; return; }
    addToCartMutation.mutate(
      { data: { productId, quantity: 1 } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: `${name} added to cart!` });
        },
      }
    );
  };

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="relative px-4 pt-10 pb-14 md:pt-20 md:pb-28 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="container mx-auto relative z-10 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
            <div className="inline-flex items-center gap-2 bg-accent/15 text-accent border border-accent/30 rounded-full px-4 py-1.5 text-sm font-medium mb-5">
              <Zap className="w-3.5 h-3.5" />
              Delivered in 30 minutes
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-serif leading-tight mb-4">
              Farm fresh to your{" "}
              <span className="text-primary relative">
                doorstep.
                <motion.span
                  className="absolute -bottom-1 left-0 h-1 bg-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
                />
              </span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              Hyperlocal, ultra-fresh vegetables and groceries sourced directly from farmers near you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/category/all">
                <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold px-8 h-12 shadow-xl shadow-primary/20">
                  Shop Fresh <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/category/leafy-vegetables">
                <Button size="lg" variant="outline" className="rounded-full border-primary/25 text-primary h-12 px-6 hover:bg-primary/5">
                  <Leaf className="mr-2 w-4 h-4" /> Leafy Greens
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 bg-white/60 border-y border-border/50">
        <div className="container mx-auto px-4">
          <h2 className="text-base font-bold mb-5 flex items-center gap-2 text-foreground">
            <Leaf className="w-4 h-4 text-accent" /> Explore by Category
          </h2>
          <div className="flex overflow-x-auto pb-2 gap-5 snap-x snap-mandatory hide-scrollbar">
            {loadingCats
              ? Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)
              : categories.map((cat: any) => (
                  <Link key={cat.id} href={`/category/${cat.slug}`} className="snap-start shrink-0">
                    <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-2">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border/50 shadow-sm bg-white">
                        <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs font-medium text-foreground whitespace-nowrap">{cat.name}</span>
                    </motion.div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Fresh Picks */}
      <section className="py-12 container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" /> Fresh Picks Today
          </h2>
          <Link href="/category/all" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {loadingFresh
            ? Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : freshPicks.slice(0, 10).map((p: any) => (
                <motion.div key={p.id} variants={fadeUp}>
                  <ProductCard product={p} onAddToCart={handleAddToCart} />
                </motion.div>
              ))}
        </motion.div>
      </section>

      {/* Trending */}
      <section className="py-12 bg-white/60 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Trending Now
            </h2>
            <Link href="/category/all" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {loadingTrending
              ? Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : trending.slice(0, 10).map((p: any) => (
                  <motion.div key={p.id} variants={fadeUp}>
                    <ProductCard product={p} onAddToCart={handleAddToCart} />
                  </motion.div>
                ))}
          </motion.div>
        </div>
      </section>

      {/* Promo strip */}
      <section className="py-10 container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-3xl bg-primary p-8 md:p-12 text-white text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10 text-[120px] leading-none select-none flex flex-wrap gap-4 p-4">
            {["🥦","🥕","🌿","🫑","🌽","🥒","🍅","🫛","🥬","🧅"].map((e,i)=>(<span key={i}>{e}</span>))}
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-bold font-serif mb-2">Fresh. Local. Fast.</h3>
            <p className="text-white/75 mb-6 max-w-md mx-auto">Support local farmers and get the freshest produce delivered within 30 minutes of harvest.</p>
            <Link href="/signup">
              <Button className="rounded-full bg-white text-primary hover:bg-white/90 font-semibold px-8 h-11">
                Join InstaVEG
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function ProductCard({ product, onAddToCart }: { product: any; onAddToCart: (id: number, name: string) => void }) {
  const discount = product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : null;

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 hover:shadow-md transition-all duration-200">
      <Link href={`/product/${product.id}`}>
        <div className="aspect-square overflow-hidden bg-muted/20 relative">
          <img
            src={product.images?.[0] ?? "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400"}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {discount && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {discount}% off
            </div>
          )}
          {product.isOrganic && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-primary/90 text-white text-[10px] px-1.5 py-0.5 gap-0.5 shadow-sm">
                <Leaf className="w-2.5 h-2.5" /> Organic
              </Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="p-3">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-medium text-sm text-foreground line-clamp-1 hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">{product.unit}</p>

        {product.rating && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] text-muted-foreground">{Number(product.rating).toFixed(1)}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-primary text-sm">₹{product.price}</span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-[11px] text-muted-foreground line-through">₹{product.mrp}</span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(product.id, product.name)}
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 active:scale-90 transition-all"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

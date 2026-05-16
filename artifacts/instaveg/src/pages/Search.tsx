import { useState, useEffect, useRef } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useAddToCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, Leaf, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const QUICK_SUGGESTIONS = [
  "Spinach", "Tomato", "Carrot", "Broccoli", "Coriander",
  "Methi", "Kale", "Potato", "Corn", "Mint",
];

export default function SearchPage() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Update URL
  useEffect(() => {
    if (debouncedQuery) {
      const p = new URLSearchParams({ q: debouncedQuery });
      setLocation(`/search?${p.toString()}`, { replace: true });
    }
  }, [debouncedQuery]);

  const searchParams = {
    search: debouncedQuery || undefined,
    minPrice,
    maxPrice,
    limit: 30,
  };

  const { data: resultsRaw, isLoading } = useListProducts(
    searchParams,
    {
      query: {
        queryKey: getListProductsQueryKey(searchParams),
        enabled: !!debouncedQuery,
      },
    }
  );
  const results = (resultsRaw as any)?.products ?? [];

  const addToCartMutation = useAddToCart();
  const handleAddToCart = (productId: number) => {
    if (!user) { setLocation("/login"); return; }
    addToCartMutation.mutate(
      { data: { productId, quantity: 1 } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: "Added to cart!" });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vegetables, fruits, herbs..."
                className="pl-9 pr-4 rounded-full border-primary/20 bg-white focus-visible:ring-primary/30 h-10"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "text-primary bg-primary/10" : "text-muted-foreground"}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-3 pt-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Min Price (₹)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      className="h-8 text-sm"
                      onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Max Price (₹)</label>
                    <Input
                      type="number"
                      placeholder="500"
                      className="h-8 text-sm"
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Quick Suggestions - shown when no query */}
        {!debouncedQuery && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-sm text-muted-foreground mb-3">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-sm text-primary hover:bg-primary/15 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && debouncedQuery && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!isLoading && debouncedQuery && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {results.length > 0
                ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${debouncedQuery}"`
                : `No results for "${debouncedQuery}"`}
            </p>

            {results.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <div className="text-6xl mb-4">🥦</div>
                <p className="text-lg font-medium text-foreground mb-1">Nothing found</p>
                <p className="text-muted-foreground text-sm">Try a different keyword or browse by category</p>
                <Link href="/category/all">
                  <Button className="mt-4 rounded-full bg-primary text-white hover:bg-primary/90">
                    Browse All
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.05 } },
                }}
              >
                {results.map((product: any) => (
                  <motion.div
                    key={product.id}
                    variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}
                    className="group relative bg-white rounded-2xl overflow-hidden border border-border/40 hover:border-primary/30 hover:shadow-md transition-all"
                  >
                    <Link href={`/product/${product.id}`}>
                      <div className="aspect-square overflow-hidden bg-muted/30">
                        <img
                          src={product.images?.[0] ?? "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400"}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </Link>

                    {product.isOrganic && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-primary/90 text-white text-[10px] px-1.5 py-0.5 gap-0.5">
                          <Leaf className="w-2.5 h-2.5" /> Organic
                        </Badge>
                      </div>
                    )}

                    <div className="p-3">
                      <Link href={`/product/${product.id}`}>
                        <h3 className="font-medium text-sm text-foreground line-clamp-1 hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{product.unit}</p>

                      <div className="flex items-center justify-between mt-2">
                        <div>
                          <span className="font-bold text-primary text-sm">₹{product.price}</span>
                          {product.mrp && product.mrp > product.price && (
                            <span className="text-xs text-muted-foreground line-through ml-1">₹{product.mrp}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleAddToCart(product.id)}
                          className="w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

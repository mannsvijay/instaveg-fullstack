import { useState } from "react";
import { useParams, Link } from "wouter";
import { useListProducts, useListCategories, useAddToCart, getGetCartQueryKey, getListCategoriesQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Leaf, ShoppingCart, SlidersHorizontal, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function CategoryBrowse() {
  const { slug } = useParams<{ slug: string }>();
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: categoriesRaw } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const categories = categoriesRaw as any[];
  const currentCategory = categories?.find((c: any) => c.slug === slug || slug === "all");

  const listParams = { category: slug !== "all" ? slug : undefined, inStock: inStock || undefined, minPrice, maxPrice, page, limit: 20 };
  const { data: productsData, isLoading } = useListProducts(listParams, { query: { queryKey: getListProductsQueryKey(listParams) } });

  const products = (productsData as any)?.products ?? [];
  const total = (productsData as any)?.total ?? 0;

  const addToCartMutation = useAddToCart();

  const handleAddToCart = (productId: number, name: string) => {
    if (!user) { window.location.href = "/login"; return; }
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-serif text-foreground">
          {slug === "all" ? "All Products" : currentCategory?.name ?? slug}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{total} products found</p>
      </div>

      {/* Category pills */}
      {categories && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <Link href="/category/all">
            <Badge
              variant={slug === "all" ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap px-4 py-1.5 rounded-full"
            >
              All
            </Badge>
          </Link>
          {categories.map((cat: any) => (
            <Link key={cat.id} href={`/category/${cat.slug}`}>
              <Badge
                variant={slug === cat.slug ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap px-4 py-1.5 rounded-full"
              >
                {cat.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 border border-border/40">
          <span className="text-sm text-muted-foreground">Min ₹</span>
          <input
            type="number"
            className="w-16 text-sm bg-transparent outline-none"
            placeholder="0"
            value={minPrice ?? ""}
            onChange={(e) => setMinPrice(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2 border border-border/40">
          <span className="text-sm text-muted-foreground">Max ₹</span>
          <input
            type="number"
            className="w-16 text-sm bg-transparent outline-none"
            placeholder="500"
            value={maxPrice ?? ""}
            onChange={(e) => setMaxPrice(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
        <button
          onClick={() => setInStock(!inStock)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
            inStock ? "bg-primary text-primary-foreground border-primary" : "bg-white/60 border-border/40"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          In Stock Only
        </button>
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Leaf className="w-12 h-12 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No products found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial="hidden"
          animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
        >
          {products.map((p: any) => {
            const image = Array.isArray(p.images) ? p.images[0] : null;
            const discount = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : null;
            return (
              <motion.div
                key={p.id}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -2 }}
                className="bg-white/70 backdrop-blur rounded-2xl overflow-hidden border border-border/30 shadow-sm flex flex-col"
              >
                <Link href={`/product/${p.id}`}>
                  <div className="relative h-40 bg-secondary/30">
                    {image ? (
                      <img src={image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Leaf className="w-8 h-8 text-primary/30" />
                      </div>
                    )}
                    {p.isOrganic && (
                      <Badge className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-primary">Organic</Badge>
                    )}
                    {discount && (
                      <Badge className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 bg-green-500 text-white">{discount}% off</Badge>
                    )}
                  </div>
                </Link>
                <div className="p-3 flex flex-col flex-1">
                  <Link href={`/product/${p.id}`}>
                    <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">{p.name}</h3>
                  </Link>
                  <div className="text-xs text-muted-foreground mb-2">per {p.unit}</div>
                  {p.rating > 0 && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs">{p.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <div>
                      <span className="font-bold text-primary">₹{p.price}</span>
                      {p.mrp && p.mrp > p.price && (
                        <span className="text-xs text-muted-foreground line-through ml-1">₹{p.mrp}</span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handleAddToCart(p.id, p.name)}
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

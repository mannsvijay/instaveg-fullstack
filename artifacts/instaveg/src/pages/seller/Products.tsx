import { useState } from "react";
import { Link } from "wouter";
import { useListProducts, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";

import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Edit3, Trash2, Package, Leaf } from "lucide-react";

export default function SellerProducts() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const sellerProductParams = { page, limit: 20 };
  const { data: productsData, isLoading } = useListProducts(sellerProductParams, { query: { queryKey: getListProductsQueryKey(sellerProductParams) } });
  const products = (productsData as any)?.products ?? [];

  const deleteMutation = useDeleteProduct();

  const handleDelete = (id: number) => {
    if (!confirm("Delete this product?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        toast({ title: "Product deleted" });
      },
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold font-serif">My Products</h1>
        <Link href="/seller/add-product">
          <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
        </Link>
      </div>

      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl mb-3" />)
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No products yet</p>
          <Link href="/seller/add-product"><Button className="mt-4 rounded-xl">Add Your First Product</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p: any) => {
            const image = Array.isArray(p.images) ? p.images[0] : null;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-4 flex items-center gap-4"
              >
                {image ? (
                  <img src={image} alt={p.name} className="w-16 h-16 rounded-xl object-cover bg-secondary flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-6 h-6 text-primary/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">₹{p.price} / {p.unit}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className={p.stock > 10 ? "bg-green-50 text-green-700 border-green-200" : p.stock > 0 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}>
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </Badge>
                    {p.isOrganic && <Badge className="bg-primary/10 text-primary border-none text-[10px]">Organic</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/seller/products/${p.id}/edit`}>
                    <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg">
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

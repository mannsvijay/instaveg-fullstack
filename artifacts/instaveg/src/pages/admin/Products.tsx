import { useState } from "react";
import { Link } from "wouter";
import { useListProducts, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Package, Edit3, Trash2 } from "lucide-react";

const PAGE_SIZE = 20;

export default function AdminProducts() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null);

  const params = { search: search || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading } = useListProducts(params, { query: { queryKey: getListProductsQueryKey(params), enabled: !!user } });
  const products = (data as any)?.products ?? [];
  const total: number = (data as any)?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const deleteMutation = useDeleteProduct();

  const confirmDelete = () => {
    if (!toDelete) return;
    const { id, name } = toDelete;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        toast({ title: `Deleted ${name}` });
        setToDelete(null);
      },
      onError: (err) => {
        toast({ title: "Could not delete product", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
        setToDelete(null);
      },
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-6">Products</h1>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products..."
          className="pl-9 bg-white/70"
        />
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 m-4 rounded-xl" />)
        ) : products.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-10 h-10 text-primary/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No products found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {products.map((p: any) => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.sellerName ?? "Unknown seller"} · {p.categoryName ?? "Uncategorised"} · ₹{p.price} / {p.unit}
                  </p>
                </div>
                <Badge className={p.stock > 10 ? "bg-green-50 text-green-700 border-green-200" : p.stock > 0 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-red-50 text-red-700 border-red-200"}>
                  {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                </Badge>
                <Link href={`/admin/products/${p.id}/edit`}>
                  <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive"
                  title="Delete"
                  onClick={() => setToDelete({ id: p.id, name: p.name })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Previous</Button>
          <span className="text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((n) => n + 1)}>Next</Button>
        </div>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" will be permanently removed from the store. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

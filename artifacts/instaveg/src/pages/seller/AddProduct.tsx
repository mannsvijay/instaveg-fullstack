import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProduct, useListCategories, getListProductsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";

export default function AddProduct() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    mrp: "",
    unit: "kg",
    stock: "",
    categoryId: "",
    images: "",
    isOrganic: false,
    isFresh: true,
    nutritionInfo: "",
    tags: "",
  });

  const { data: categoriesRaw } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const categories = (categoriesRaw as any[]) ?? [];

  const createMutation = useCreateProduct();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        data: {
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          mrp: form.mrp ? parseFloat(form.mrp) : undefined,
          unit: form.unit,
          stock: parseInt(form.stock),
          categoryId: parseInt(form.categoryId),
          images: form.images ? form.images.split(",").map((s) => s.trim()).filter(Boolean) : [],
          isOrganic: form.isOrganic,
          isFresh: form.isFresh,
          nutritionInfo: form.nutritionInfo,
          tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
          toast({ title: "Product created successfully!" });
          setLocation("/seller/products");
        },
        onError: (err) => {
          toast({ title: "Failed to create product", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
        },
      }
    );
  };

  const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => history.back()} className="flex items-center gap-2 text-muted-foreground text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold font-serif mb-6">Add New Product</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Info</h3>
          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input value={form.name} onChange={(e) => setField("name", e.target.value)} required className="bg-white/50" placeholder="Fresh Broccoli" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="w-full rounded-lg border border-input bg-white/50 px-3 py-2 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Describe your product..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <select
              value={form.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-white/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="">Select category</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Pricing & Stock</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (₹) *</Label>
              <Input type="number" value={form.price} onChange={(e) => setField("price", e.target.value)} required min="0" step="0.01" className="bg-white/50" placeholder="40" />
            </div>
            <div className="space-y-1.5">
              <Label>MRP (₹)</Label>
              <Input type="number" value={form.mrp} onChange={(e) => setField("mrp", e.target.value)} min="0" step="0.01" className="bg-white/50" placeholder="50" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit *</Label>
              <select value={form.unit} onChange={(e) => setField("unit", e.target.value)} className="w-full rounded-lg border border-input bg-white/50 px-3 py-2 text-sm">
                {["kg", "g", "piece", "bunch", "litre", "500g", "250g"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Stock *</Label>
              <Input type="number" value={form.stock} onChange={(e) => setField("stock", e.target.value)} required min="0" className="bg-white/50" placeholder="100" />
            </div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Media & Tags</h3>
          <div className="space-y-1.5">
            <Label>Image URLs (comma separated)</Label>
            <Input value={form.images} onChange={(e) => setField("images", e.target.value)} className="bg-white/50" placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Tags (comma separated)</Label>
            <Input value={form.tags} onChange={(e) => setField("tags", e.target.value)} className="bg-white/50" placeholder="seasonal, local, fresh" />
          </div>
          <div className="space-y-1.5">
            <Label>Nutrition Info</Label>
            <Input value={form.nutritionInfo} onChange={(e) => setField("nutritionInfo", e.target.value)} className="bg-white/50" placeholder="Rich in Vitamin C..." />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isOrganic} onChange={(e) => setField("isOrganic", e.target.checked)} className="accent-primary" />
              Organic
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isFresh} onChange={(e) => setField("isFresh", e.target.checked)} className="accent-primary" />
              Fresh
            </label>
          </div>
        </div>

        <Button type="submit" className="w-full h-12 rounded-xl font-semibold" disabled={createMutation.isPending}>
          {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Product"}
        </Button>
      </form>
    </div>
  );
}

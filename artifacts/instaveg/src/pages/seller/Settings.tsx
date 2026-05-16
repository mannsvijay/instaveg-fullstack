import { useState, useEffect } from "react";
import { useUpdateSellerProfile } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function SellerSettings() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [form, setForm] = useState({
    storeName: "",
    description: "",
    address: "",
    city: "",
    phone: "",
    deliveryRadius: "10",
  });

  const updateMutation = useUpdateSellerProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        data: {
          storeName: form.storeName,
          description: form.description,
          address: form.address,
          city: form.city,
          phone: form.phone,
          deliveryRadius: parseFloat(form.deliveryRadius),
        },
      },
      {
        onSuccess: () => toast({ title: "Settings saved!" }),
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold font-serif mb-8">Store Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Store Info</h3>
          <div className="space-y-1.5">
            <Label>Store Name</Label>
            <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} className="bg-white/50" placeholder="My Fresh Farm" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-input bg-white/50 px-3 py-2 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="About your store..."
            />
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Location</h3>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="bg-white/50" placeholder="Farm address" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} className="bg-white/50" placeholder="Pune" />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Radius (km)</Label>
              <Input type="number" value={form.deliveryRadius} onChange={(e) => set("deliveryRadius", e.target.value)} min="1" max="50" className="bg-white/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="bg-white/50" placeholder="+91 ..." />
          </div>
        </div>

        <Button type="submit" className="w-full h-12 rounded-xl" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}

import { useAdminGetPendingSellers, useAdminApproveSeller, getAdminGetPendingSellersQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Store, CheckCircle, XCircle } from "lucide-react";

export default function AdminSellers() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sellersRaw, isLoading } = useAdminGetPendingSellers({ query: { queryKey: getAdminGetPendingSellersQueryKey(), enabled: !!user } });
  const sellers = (sellersRaw as any[]) ?? [];

  const approveMutation = useAdminApproveSeller();

  const handleAction = (id: number, action: "approved" | "rejected") => {
    approveMutation.mutate(
      { id, data: { status: action } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getAdminGetPendingSellersQueryKey() });
          toast({ title: action === "approved" ? "Seller approved!" : "Seller rejected" });
        },
      }
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-6">Pending Seller Approvals</h1>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl mb-4" />)
      ) : sellers.length === 0 ? (
        <div className="text-center py-20 bg-white/70 rounded-2xl border border-border/30">
          <CheckCircle className="w-12 h-12 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No pending approvals</p>
          <p className="text-sm text-muted-foreground mt-1">All seller applications have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sellers.map((seller: any) => (
            <motion.div
              key={seller.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{seller.storeName}</h3>
                    <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">Pending</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Owner: {seller.ownerName}</p>
                  {seller.city && <p className="text-xs text-muted-foreground">{seller.city}</p>}
                  {seller.description && <p className="text-sm mt-2">{seller.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Applied: {new Date(seller.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button
                  className="flex-1 rounded-xl bg-primary"
                  onClick={() => handleAction(seller.id, "approved")}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                  onClick={() => handleAction(seller.id, "rejected")}
                  disabled={approveMutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

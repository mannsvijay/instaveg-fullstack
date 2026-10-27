import { useState } from "react";
import { useAdminListSellers, useAdminApproveSeller, getAdminListSellersQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Store, CheckCircle, XCircle, PauseCircle, PlayCircle } from "lucide-react";

type Tab = "pending" | "approved" | "suspended";
type NewStatus = "approved" | "rejected" | "suspended";

const TABS: { value: Tab; label: string; empty: string }[] = [
  { value: "pending", label: "Pending", empty: "No pending applications" },
  { value: "approved", label: "Approved", empty: "No approved sellers" },
  { value: "suspended", label: "Suspended", empty: "No suspended sellers" },
];

const STATUS_BADGE: Record<Tab, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
};

// Confirmation copy for the actions that need it (M13).
const CONFIRM: Partial<Record<NewStatus, { title: string; body: string; action: string }>> = {
  suspended: {
    title: "Suspend this seller?",
    body: "Their products are hidden from buyers and they cannot add, edit or delete products until reactivated.",
    action: "Suspend",
  },
  approved: {
    title: "Reactivate this seller?",
    body: "Their products become visible to buyers again and they can manage their listings.",
    action: "Reactivate",
  },
};

export default function AdminSellers() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [confirming, setConfirming] = useState<{ id: number; storeName: string; status: NewStatus } | null>(null);

  const params = { status: tab };
  const { data: sellersRaw, isLoading } = useAdminListSellers(params, {
    query: { queryKey: getAdminListSellersQueryKey(params), enabled: !!user },
  });
  const sellers = (sellersRaw as any[]) ?? [];

  const statusMutation = useAdminApproveSeller();

  const changeStatus = (id: number, status: NewStatus, storeName: string) => {
    statusMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getAdminListSellersQueryKey({}) });
          const verb = { approved: tab === "suspended" ? "reactivated" : "approved", rejected: "rejected", suspended: "suspended" }[status];
          toast({ title: `${storeName} ${verb}` });
          setConfirming(null);
        },
        onError: (err) => {
          const apiMessage = (err as { data?: { error?: unknown } }).data?.error;
          toast({
            title: "Could not update the seller",
            description: typeof apiMessage === "string" ? apiMessage : err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
          setConfirming(null);
        },
      },
    );
  };

  const dialog = confirming ? CONFIRM[confirming.status] : undefined;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-6">Sellers</h1>

      <div className="flex gap-2 mb-6" role="tablist">
        {TABS.map((t) => (
          <Button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            size="sm"
            variant={tab === t.value ? "default" : "outline"}
            className="rounded-lg"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl mb-4" />)
      ) : sellers.length === 0 ? (
        <div className="text-center py-20 bg-white/70 rounded-2xl border border-border/30">
          <CheckCircle className="w-12 h-12 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{TABS.find((t) => t.value === tab)?.empty}</p>
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
                    <Badge className={`${STATUS_BADGE[tab]} text-[10px] capitalize`}>{seller.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Owner: {seller.ownerName}</p>
                  {seller.city && <p className="text-xs text-muted-foreground">{seller.city}</p>}
                  {seller.description && <p className="text-sm mt-2">{seller.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Applied: {new Date(seller.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                {tab === "pending" && (
                  <>
                    <Button
                      className="flex-1 rounded-xl bg-primary"
                      onClick={() => changeStatus(seller.id, "approved", seller.storeName)}
                      disabled={statusMutation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => changeStatus(seller.id, "rejected", seller.storeName)}
                      disabled={statusMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </>
                )}
                {tab === "approved" && (
                  <Button
                    variant="outline"
                    className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => setConfirming({ id: seller.id, storeName: seller.storeName, status: "suspended" })}
                    disabled={statusMutation.isPending}
                  >
                    <PauseCircle className="w-4 h-4 mr-2" /> Suspend
                  </Button>
                )}
                {tab === "suspended" && (
                  <Button
                    className="rounded-xl"
                    onClick={() => setConfirming({ id: seller.id, storeName: seller.storeName, status: "approved" })}
                    disabled={statusMutation.isPending}
                  >
                    <PlayCircle className="w-4 h-4 mr-2" /> Reactivate
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => { if (!open) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirming?.storeName}</strong>: {dialog?.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirming) changeStatus(confirming.id, confirming.status, confirming.storeName);
              }}
              disabled={statusMutation.isPending}
              className={confirming?.status === "suspended" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {dialog?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

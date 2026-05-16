import { useState } from "react";
import { useAdminListUsers, useAdminUpdateUser, getAdminListUsersQueryKey } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck, UserX } from "lucide-react";

export default function AdminUsers() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | undefined>();

  const adminUsersParams = { search: search || undefined, role };
  const { data: usersRaw, isLoading } = useAdminListUsers(
    adminUsersParams,
    { query: { queryKey: getAdminListUsersQueryKey(adminUsersParams), enabled: !!user } }
  );
  const users = (usersRaw as any[]) ?? [];

  const updateMutation = useAdminUpdateUser();

  const toggleStatus = (userId: number, isActive: boolean) => {
    updateMutation.mutate(
      { id: userId, data: { isActive: !isActive } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getAdminListUsersQueryKey({}) });
          toast({ title: !isActive ? "User activated" : "User suspended" });
        },
      }
    );
  };

  const ROLE_COLOR: Record<string, string> = {
    buyer: "bg-blue-50 text-blue-700 border-blue-200",
    seller: "bg-green-50 text-green-700 border-green-200",
    admin: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-serif mb-6">Users</h1>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 bg-white/70"
          />
        </div>
        <div className="flex gap-2">
          {["", "buyer", "seller", "admin"].map((r) => (
            <Button
              key={r}
              size="sm"
              variant={role === r || (!role && r === "") ? "default" : "outline"}
              onClick={() => setRole(r || undefined)}
              className="rounded-lg capitalize"
            >
              {r || "All"}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 overflow-hidden">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 m-4 rounded-xl" />)
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No users found</div>
        ) : (
          <div className="divide-y divide-border/20">
            {users.map((u: any) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {u.name?.[0] ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge className={`text-[10px] ${ROLE_COLOR[u.role] ?? ""}`}>{u.role}</Badge>
                <Badge className={u.isActive ? "bg-green-50 text-green-700 border-green-200 text-[10px]" : "bg-red-50 text-red-700 border-red-200 text-[10px]"}>
                  {u.isActive ? "Active" : "Suspended"}
                </Badge>
                <button
                  onClick={() => toggleStatus(u.id, u.isActive)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={u.isActive ? "Suspend" : "Activate"}
                >
                  {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

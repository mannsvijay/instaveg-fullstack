import { useState } from "react";
import { useGetUserProfile, useUpdateUserProfile, useListAddresses, useAddAddress, useDeleteAddress } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetUserProfileQueryKey, getListAddressesQueryKey } from "@workspace/api-client-react";
import { User, MapPin, LogOut, Plus, Trash2, Edit3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";

export default function Profile() {
  const { user, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", street: "", city: "", state: "", pincode: "" });

  const { data: profileRaw, isLoading } = useGetUserProfile({ query: { queryKey: getGetUserProfileQueryKey(), enabled: !!user } });
  const profile = profileRaw as any;

  const { data: addressesRaw } = useListAddresses({ query: { queryKey: getListAddressesQueryKey(), enabled: !!user } });
  const addresses = (addressesRaw as any[]) ?? [];

  const updateMutation = useUpdateUserProfile();
  const addAddressMutation = useAddAddress();
  const deleteAddressMutation = useDeleteAddress();

  const handleUpdateProfile = () => {
    updateMutation.mutate(
      { data: { name: name || profile?.name, phone: phone || profile?.phone } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
          toast({ title: "Profile updated" });
          setEditingProfile(false);
        },
      }
    );
  };

  const handleAddAddress = () => {
    addAddressMutation.mutate(
      { data: { ...newAddr, isDefault: addresses.length === 0 } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAddressesQueryKey() });
          toast({ title: "Address added" });
          setShowAddAddress(false);
          setNewAddr({ label: "Home", street: "", city: "", state: "", pincode: "" });
        },
      }
    );
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center max-w-md">
        <User className="w-16 h-16 text-primary/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Not signed in</h2>
        <Link href="/login"><Button className="rounded-xl px-8 mt-4">Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-2xl font-bold font-serif mb-6">My Profile</h1>

      {/* Profile Card */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-6 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-bold text-primary">
            {profile?.name?.[0] ?? user.name?.[0] ?? "U"}
          </div>
          <div>
            <h2 className="font-bold text-lg">{isLoading ? <Skeleton className="h-6 w-32" /> : profile?.name}</h2>
            <p className="text-muted-foreground text-sm">{profile?.email}</p>
            <Badge className="mt-1 bg-accent/20 text-accent-foreground border-none capitalize">{profile?.role ?? user.role}</Badge>
          </div>
          <button
            onClick={() => { setEditingProfile(true); setName(profile?.name ?? ""); setPhone(profile?.phone ?? ""); }}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <Edit3 className="w-5 h-5" />
          </button>
        </div>

        {editingProfile ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 mt-4 border-t border-border/20 pt-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white/50" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateProfile} disabled={updateMutation.isPending} className="flex-1 rounded-xl">Save</Button>
              <Button variant="outline" onClick={() => setEditingProfile(false)} className="flex-1 rounded-xl">Cancel</Button>
            </div>
          </motion.div>
        ) : null}
      </div>

      {/* Addresses */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Saved Addresses</h3>
          <button onClick={() => setShowAddAddress(true)} className="text-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {addresses.length === 0 && !showAddAddress && (
          <p className="text-sm text-muted-foreground">No addresses saved yet.</p>
        )}

        {addresses.map((addr: any) => (
          <div key={addr.id} className="flex items-start gap-3 mb-3 last:mb-0">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{addr.label}</span>
                {addr.isDefault && <Badge className="text-[10px] bg-primary/10 text-primary border-none">Default</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{addr.street}, {addr.city}, {addr.state} - {addr.pincode}</p>
            </div>
            <button onClick={() => deleteAddressMutation.mutate({ id: addr.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListAddressesQueryKey() }) })}>
              <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}

        {showAddAddress && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-3 border-t border-border/20 pt-4">
            <div className="grid grid-cols-2 gap-2">
              {["Home", "Work", "Other"].map((l) => (
                <button
                  key={l}
                  onClick={() => setNewAddr(a => ({ ...a, label: l }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${newAddr.label === l ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/40"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {["street", "city", "state", "pincode"].map((field) => (
              <Input
                key={field}
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(newAddr as any)[field]}
                onChange={(e) => setNewAddr(a => ({ ...a, [field]: e.target.value }))}
                className="bg-white/50"
              />
            ))}
            <div className="flex gap-2">
              <Button onClick={handleAddAddress} disabled={addAddressMutation.isPending} className="flex-1 rounded-xl">Save Address</Button>
              <Button variant="outline" onClick={() => setShowAddAddress(false)} className="flex-1 rounded-xl">Cancel</Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-white/70 backdrop-blur rounded-2xl border border-border/30 overflow-hidden mb-4">
        {[
          { label: "My Orders", href: "/orders", icon: "📦" },
          { label: "Wishlist", href: "/wishlist", icon: "❤️" },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <div className="flex items-center gap-3 px-5 py-4 hover:bg-secondary/30 border-b border-border/20 last:border-0 transition-colors">
              <span>{link.icon}</span>
              <span className="font-medium text-sm">{link.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <Button variant="outline" onClick={handleLogout} className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5">
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}

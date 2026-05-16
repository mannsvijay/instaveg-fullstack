import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { setToken, setUser } = useAuthStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { data: { name, email, password, phone, role } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setUser(data.user);
          toast({ title: "Welcome to InstaVEG!", description: "Account created successfully." });
          if (data.user.role === "seller") setLocation("/seller/dashboard");
          else setLocation("/");
        },
        onError: (err) => {
          toast({
            title: "Registration failed",
            description: err instanceof Error ? err.message : "Something went wrong",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-3xl font-bold text-primary tracking-tight">
            InstaVEG
          </Link>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>

        <Card className="p-6 md:p-8 bg-white/80 backdrop-blur-xl border-border/50 shadow-xl shadow-primary/5 rounded-2xl">
          <Tabs defaultValue="buyer" onValueChange={(v) => setRole(v as "buyer" | "seller")} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="buyer" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Buyer
              </TabsTrigger>
              <TabsTrigger value="seller" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Seller
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-white/50 border-border/50 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="priya@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/50 border-border/50 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-white/50 border-border/50 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/50 border-border/50 focus-visible:ring-primary/20"
              />
            </div>

            {role === "seller" && (
              <p className="text-xs text-muted-foreground bg-accent/10 px-3 py-2 rounded-lg">
                Seller accounts require admin approval before you can list products.
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold mt-6 rounded-xl"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                `Create ${role === "seller" ? "Seller" : ""} Account`
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { setToken, setUser } = useAuthStore();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setUser(data.user);
          toast({ title: "Welcome back!", description: "Successfully logged in." });
          if (data.user.role === "admin") setLocation("/admin");
          else if (data.user.role === "seller") setLocation("/seller/dashboard");
          else setLocation("/");
        },
        onError: (err) => {
          toast({ 
            title: "Login failed", 
            description: err instanceof Error ? err.message : "Invalid credentials",
            variant: "destructive"
          });
        }
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
        {/* Back button */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-3xl font-bold text-primary tracking-tight">InstaVEG</Link>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <Card className="p-6 md:p-8 bg-white/80 backdrop-blur-xl border-border/50 shadow-xl shadow-primary/5 rounded-2xl">
          <Tabs defaultValue="buyer" onValueChange={(v) => setRole(v as any)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="buyer" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Buyer</TabsTrigger>
              <TabsTrigger value="seller" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Seller</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="hello@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/50 border-border/50 focus-visible:ring-primary/20"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/50 border-border/50 focus-visible:ring-primary/20"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold mt-6 rounded-xl"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary font-semibold hover:underline">Sign up</Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

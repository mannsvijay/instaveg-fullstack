import { ReactNode } from "react";
import { Link } from "wouter";
import { ShoppingCart, User, Home, Search, Heart, Menu } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-primary tracking-tight">InstaVEG</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/search" className="text-foreground hover:text-primary transition-colors">
              <Search className="w-5 h-5" />
            </Link>
            <Link href="/cart" className="text-foreground hover:text-primary transition-colors relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-accent text-accent-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">0</span>
            </Link>
            {user ? (
              <Link href="/profile" className="hidden md:flex text-foreground hover:text-primary transition-colors">
                <User className="w-5 h-5" />
              </Link>
            ) : (
              <Link href="/login" className="hidden md:flex">
                <Button variant="outline" size="sm" className="rounded-full border-primary/20 text-primary">Login</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/90 backdrop-blur-md z-50">
        <div className="flex items-center justify-around h-16 px-4">
          <Link href="/" className="flex flex-col items-center gap-1 text-primary">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/category/all" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Categories</span>
          </Link>
          <Link href="/wishlist" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <Heart className="w-5 h-5" />
            <span className="text-[10px] font-medium">Wishlist</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

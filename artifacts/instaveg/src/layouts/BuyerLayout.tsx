import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, User, Home, Search, Heart, Menu, X, Leaf } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetCart, getGetCartQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

function CartCount() {
  const { user } = useAuthStore();
  const { data } = useGetCart({ query: { queryKey: getGetCartQueryKey(), enabled: !!user } });
  const cart = data as any;
  const count = cart?.items?.length ?? 0;
  if (!count) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">

          {/* Logo — hidden when search is open on mobile */}
          <AnimatePresence mode="wait">
            {!searchOpen && (
              <motion.div
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 shrink-0"
              >
                <Link href="/" className="flex items-center gap-1.5">
                  <Leaf className="w-5 h-5 text-primary" />
                  <span className="font-serif text-2xl font-bold text-primary tracking-tight">InstaVEG</span>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline Search Bar — expands in header */}
          <AnimatePresence>
            {searchOpen && (
              <motion.form
                key="search-bar"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: 0 }}
                onSubmit={handleSearchSubmit}
                className="flex-1 flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search vegetables, fruits, herbs..."
                    className="pl-9 rounded-full border-primary/25 bg-white focus-visible:ring-primary/30 h-9"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-full bg-primary text-white hover:bg-primary/90 shrink-0"
                >
                  Search
                </Button>
                <button
                  type="button"
                  onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Right Actions */}
          {!searchOpen && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSearchOpen(true)}
                className="text-foreground hover:text-primary transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              <Link href="/cart" className="text-foreground hover:text-primary transition-colors relative">
                <ShoppingCart className="w-5 h-5" />
                <CartCount />
              </Link>

              {user ? (
                <Link href="/profile" className="hidden md:flex text-foreground hover:text-primary transition-colors">
                  <User className="w-5 h-5" />
                </Link>
              ) : (
                <Link href="/login" className="hidden md:flex">
                  <Button variant="outline" size="sm" className="rounded-full border-primary/20 text-primary">
                    Login
                  </Button>
                </Link>
              )}
            </div>
          )}
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
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
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

import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/useAuthStore";
import { useGetFreshPicks, useGetTrendingProducts, useListCategories, getGetFreshPicksQueryKey, getGetTrendingProductsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { IMAGES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, ShoppingCart, Timer, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: freshPicks } = useGetFreshPicks({}, { query: { queryKey: getGetFreshPicksQueryKey() } });
  const { data: trending } = useGetTrendingProducts({}, { query: { queryKey: getGetTrendingProductsQueryKey() } });
  const { data: categories } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative px-4 pt-8 pb-12 md:pt-16 md:pb-24 overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <Badge className="bg-accent/20 text-primary hover:bg-accent/30 mb-6 border-none px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 w-fit">
              <Timer className="w-3.5 h-3.5" />
              Delivered in 30 minutes
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight leading-tight mb-4">
              Farm fresh to your <br className="hidden md:block"/>
              <span className="text-primary relative whitespace-nowrap">
                doorstep.
                <span className="absolute -bottom-2 left-0 w-full h-2 bg-accent/30 rounded-full" />
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-lg">
              Hyperlocal, ultra-fresh vegetables and groceries sourced directly from farmers near you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/category/all">
                <Button size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 h-12 w-full sm:w-auto shadow-xl shadow-primary/20">
                  Shop Fresh
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-8 bg-white/50 border-y border-border/50">
        <div className="container mx-auto px-4">
          <h2 className="text-lg font-bold font-serif mb-6 flex items-center gap-2">
            <Leaf className="w-5 h-5 text-accent" />
            Explore by Category
          </h2>
          <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-4 snap-x snap-mandatory hide-scrollbar">
            {[
              { name: 'Leafy Greens', image: IMAGES.catLeafy },
              { name: 'Root Veggies', image: IMAGES.catRoot },
              { name: 'Fresh Fruits', image: IMAGES.catFruits },
              { name: 'Seasonal', image: IMAGES.tomatoes },
            ].map((cat, i) => (
              <Link key={i} href={`/category/all`} className="snap-start shrink-0">
                <motion.div whileHover={{ y: -4 }} className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-background border border-border shadow-sm overflow-hidden flex items-center justify-center p-2">
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-contain" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{cat.name}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Fresh Picks */}
      <section className="py-12 md:py-16 container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Fresh Picks Today
          </h2>
          <Link href="/category/all" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>

        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
        >
          {/* Mocking products since backend might not be seeded */}
          {[
            { id: 1, name: 'Fresh Broccoli', price: 85, unit: '500g', img: IMAGES.broccoli, tag: 'Organic' },
            { id: 2, name: 'Farm Carrots', price: 45, unit: '1kg', img: IMAGES.carrots, tag: 'Fresh' },
            { id: 3, name: 'Baby Spinach', price: 30, unit: '250g', img: IMAGES.spinach, tag: 'Local' },
            { id: 4, name: 'Vine Tomatoes', price: 60, unit: '500g', img: IMAGES.tomatoes, tag: 'Bestseller' },
          ].map((product) => (
            <motion.div key={product.id} variants={item}>
              <Card className="group relative bg-card rounded-2xl overflow-hidden border-border shadow-sm hover:shadow-md transition-all duration-300">
                <div className="absolute top-3 left-3 z-10">
                  <Badge className="bg-accent text-accent-foreground border-none font-semibold shadow-sm">{product.tag}</Badge>
                </div>
                <div className="aspect-square bg-white p-6 flex items-center justify-center relative">
                  <img src={product.img} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4 bg-card">
                  <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{product.unit}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-bold text-lg text-primary">₹{product.price}</span>
                    <Button size="icon" className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 shadow-sm">
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}

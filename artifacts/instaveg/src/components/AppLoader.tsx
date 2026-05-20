import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const VEGGIES = ["🥦", "🥕", "🌿", "🫑", "🧅", "🌽", "🥒", "🍅", "🫛", "🥬"];

export default function AppLoader({ show }: { show: boolean }) {
  const [emoji, setEmoji] = useState(0);

  useEffect(() => {
    if (!show) return;
    const t = setInterval(() => {
      setEmoji((e) => (e + 1) % VEGGIES.length);
    }, 300);
    return () => clearInterval(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="app-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeOut" } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F6FCDF]"
        >
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-accent/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          {/* Bouncing veggie */}
          <motion.div
            key={emoji}
            initial={{ y: -20, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="text-7xl mb-6 select-none"
          >
            {VEGGIES[emoji]}
          </motion.div>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <h1 className="font-serif text-4xl font-bold text-primary tracking-tight">InstaVEG</h1>
            <p className="text-muted-foreground mt-1 text-sm">Farm fresh to your doorstep</p>
          </motion.div>

          {/* Animated dots */}
          <div className="flex gap-1.5 mt-8">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/40"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

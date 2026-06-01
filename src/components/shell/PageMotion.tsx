"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * Transition de page très subtile : fondu + léger décalage vertical à chaque
 * changement de pathname. Sans exit (qui pose des soucis en App Router) —
 * la nouvelle page apparaît simplement en douceur.
 */
export default function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

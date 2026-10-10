"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { MOTION } from "@/lib/design/motion";

/**
 * Transition de page très subtile : fondu + léger décalage vertical (4 px, 180 ms)
 * à chaque changement de pathname. Sans exit (qui pose des soucis en App Router) —
 * la nouvelle page apparaît simplement en douceur. Sous `prefers-reduced-motion`
 * la page apparaît sans aucun mouvement ni fondu.
 */
export default function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      initial={reduced ? false : { opacity: 0, y: MOTION.distance.fade }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.duration.base, ease: MOTION.ease.out }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { MOTION } from "@/lib/design/motion";

/**
 * Transition de navigation, identique pour toutes les pages du shell : simple
 * fondu (180 ms) à chaque changement de pathname, sans exit (qui pose des
 * soucis en App Router). Le mouvement — montée de 4 px — appartient aux GROUPES
 * de la page (<Reveal>), pour qu'une page n'additionne jamais deux translations.
 * Sous `prefers-reduced-motion`, la page apparaît sans fondu.
 */
export default function PageMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={pathname}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION.duration.base, ease: MOTION.ease.out }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

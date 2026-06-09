"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

/**
 * Carte de feature « sobre » : révélation au scroll en léger décalage (stagger
 * via `index`) + liseré supérieur discret au survol. `motion` gère lui-même
 * `prefers-reduced-motion` (les transforms sont neutralisés).
 */
export default function FeatureCard({
  icon: Icon,
  title,
  body,
  index = 0,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.08,
      }}
      className="group relative overflow-hidden rounded-[14px] border border-[var(--kyb-line)] bg-[var(--kyb-bg2)] p-5 transition-colors duration-300 hover:border-[rgba(124,92,255,0.28)]"
    >
      {/* liseré supérieur, révélé au survol */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity duration-300 group-hover:opacity-70"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--kyb-violet), transparent)",
        }}
      />
      <div
        className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-[10px]"
        style={{
          background: "color-mix(in srgb, var(--kyb-violet) 10%, transparent)",
          color: "var(--kyb-violet-soft)",
        }}
      >
        <Icon size={17} />
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold text-[var(--kyb-text-hi)]">
        {title}
      </h3>
      <p className="text-[12.5px] leading-relaxed text-[var(--kyb-text-mid)]">
        {body}
      </p>
    </motion.div>
  );
}

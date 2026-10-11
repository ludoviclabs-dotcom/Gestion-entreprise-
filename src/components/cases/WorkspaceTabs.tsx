"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "graphe", label: "Graphe" },
  { slug: "timeline", label: "Timeline" },
  { slug: "risques", label: "Risques" },
  { slug: "analyse", label: "Analyse" },
  { slug: "sources", label: "Sources" },
];

/** Onglets du dossier : numérotés, en chasse fixe, soulignés à l'encre (charte « Registre / Nuit »). */
export default function WorkspaceTabs({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Vues du dossier"
      className="mx-4 mt-[18px] flex flex-wrap gap-x-[26px] gap-y-2 border-b border-border font-mono text-xs sm:mx-8"
    >
      {TABS.map(({ slug, label }, i) => {
        const href = `/cases/${caseId}/${slug}`;
        const active = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex gap-2 border-b pb-2.5 transition-ui",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden className={active ? "text-primary" : "text-subtle"}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

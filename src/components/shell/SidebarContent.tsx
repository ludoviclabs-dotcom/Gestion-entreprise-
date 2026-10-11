"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, MotionConfig } from "motion/react";
import BrandMark from "./BrandMark";
import { APP_NAV, isNavActive, type NavReview } from "./nav";
import { SidebarCount, SidebarHeader, SidebarItem, SidebarNav } from "./Sidebar";

/**
 * Contenu de la sidebar : marque + navigation principale (APP_NAV).
 * Partagé entre la sidebar fixe (desktop / rail tablette) et le tiroir mobile.
 * `instance` isole le liseré glissant de chaque instance (les deux peuvent être
 * montées en même temps). Le mode d'exécution est affiché dans la Topbar.
 */
export default function SidebarContent({
  review,
  instance,
  onNavigate,
}: {
  /** Dossiers à revoir (badge de l'entrée « Dossiers »). */
  review?: NavReview;
  instance: "desktop" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-full flex-col">
        <SidebarHeader>
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-md text-sidebar-foreground"
          >
            <BrandMark />
            <span className="font-display text-lg font-semibold rail:sr-only">KYB Graph</span>
          </Link>
        </SidebarHeader>

        <LayoutGroup id={`sidebar-${instance}`}>
          <SidebarNav label="Navigation principale">
            {APP_NAV.map(({ href, label, shortLabel, icon }) => (
              <SidebarItem
                key={href}
                href={href}
                icon={icon}
                shortLabel={shortLabel}
                indicatorId="sidebar-active"
                active={isNavActive(pathname, href)}
                onClick={onNavigate}
                badge={
                  href === "/cases" && review && review.count > 0 ? (
                    <SidebarCount
                      value={review.count}
                      tone={review.tone}
                      srLabel={review.count > 1 ? "dossiers à revoir" : "dossier à revoir"}
                    />
                  ) : undefined
                }
              >
                {label}
              </SidebarItem>
            ))}
          </SidebarNav>
        </LayoutGroup>
      </div>
    </MotionConfig>
  );
}

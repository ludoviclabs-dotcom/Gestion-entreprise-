"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Network,
  BriefcaseBusiness,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/cases", label: "Dossiers", icon: FolderOpen },
  { href: "/secteurs", label: "Secteurs 2026", icon: BriefcaseBusiness },
  { href: "/reglages", label: "Réglages", icon: Settings },
];

/**
 * Contenu de la sidebar (logo + nav + badge démo).
 * Partagé entre la sidebar desktop fixe et le drawer mobile (Sheet).
 */
export default function SidebarContent({
  demoMode,
  onNavigate,
}: {
  demoMode: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-4 text-sidebar-foreground"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Network size={18} />
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
          KYB Graph
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: demoMode ? "#f59e0b" : "#10b981" }}
          />
          {demoMode ? "Mode démo" : "Mode live"}
        </span>
      </div>
    </div>
  );
}

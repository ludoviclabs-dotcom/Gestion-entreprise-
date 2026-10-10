"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  BriefcaseBusiness,
  Coins,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import BrandMark from "./BrandMark";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarNav,
} from "./Sidebar";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/cases", label: "Dossiers", icon: FolderOpen },
  { href: "/transactions", label: "Transactions", icon: Coins },
  { href: "/secteurs", label: "Secteurs 2026", icon: BriefcaseBusiness },
  { href: "/reglages", label: "Réglages", icon: Settings },
];

/**
 * Contenu de la sidebar (marque + navigation + mode d'exécution).
 * Partagé entre la sidebar desktop fixe et le drawer mobile (Sheet).
 * Assemble les briques génériques de ./Sidebar : aucune valeur de style en dur.
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
      <SidebarHeader>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md text-sidebar-foreground"
        >
          <BrandMark />
          <span className="font-display text-lg font-semibold">KYB Graph</span>
        </Link>
      </SidebarHeader>

      <SidebarNav label="Navigation principale">
        {NAV.map(({ href, label, icon }) => (
          <SidebarItem
            key={href}
            href={href}
            icon={icon}
            active={pathname === href || pathname.startsWith(`${href}/`)}
            onClick={onNavigate}
          >
            {label}
          </SidebarItem>
        ))}
      </SidebarNav>

      <SidebarFooter>
        <StatusBadge tone={demoMode ? "vigilance" : "success"}>
          {demoMode ? "Mode démo" : "Mode live"}
        </StatusBadge>
      </SidebarFooter>
    </div>
  );
}

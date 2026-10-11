import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Coins,
  FolderOpen,
  LayoutDashboard,
  Settings,
} from "lucide-react";

/**
 * Navigation principale — SOURCE UNIQUE. Lue par la sidebar (desktop, rail
 * tablette, tiroir mobile), la palette de recherche globale et les accès rapides
 * du tableau de bord : un libellé ou une route ne change qu'ici.
 */
export type AppNavItem = {
  href: string;
  label: string;
  /** Libellé court pour la sidebar compacte (rail tablette) : 2 lignes maximum. */
  shortLabel: string;
  /** Ce que l'on trouve sur la page (accès rapides, recherche globale). */
  description: string;
  icon: LucideIcon;
  /** Mots-clés supplémentaires pour la recherche globale. */
  keywords?: string[];
};

export const APP_NAV: readonly AppNavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    shortLabel: "Tableau de bord",
    description: "Dossiers à revoir, signaux élevés et activité récente.",
    icon: LayoutDashboard,
    keywords: ["accueil", "synthèse", "portefeuille"],
  },
  {
    href: "/cases",
    label: "Dossiers",
    shortLabel: "Dossiers",
    description: "Tous les dossiers de cartographie et la répartition des signaux.",
    icon: FolderOpen,
    keywords: ["cas", "sociétés", "siren"],
  },
  {
    href: "/transactions",
    label: "Transactions",
    shortLabel: "Transactions",
    description: "Relevé CSV : Benford, doublons, montants aberrants, IBAN réutilisés. Analyse locale.",
    icon: Coins,
    keywords: ["paiements", "relevé", "csv", "iban", "benford", "flux"],
  },
  {
    href: "/secteurs",
    label: "Secteurs 2026",
    shortLabel: "Secteurs",
    description: "Matrice des menaces 2026 par secteur : exposition, signaux KYB, preuves attendues.",
    icon: BriefcaseBusiness,
    keywords: ["menaces", "exposition", "matrice"],
  },
  {
    href: "/reglages",
    label: "Réglages",
    shortLabel: "Réglages",
    description: "Mode d'exécution et statut réel de chaque source de données.",
    icon: Settings,
    keywords: ["paramètres", "connecteurs", "sources"],
  },
];

/** Compteur de dossiers à revoir affiché sur l'entrée « Dossiers ». */
export type NavReview = { count: number; tone: "critical" | "vigilance" };

/**
 * Une entrée est active sur sa route ET ses sous-routes (`/cases/123/graphe`
 * active « Dossiers »), jamais sur un simple préfixe (`/cases-archive` non).
 */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

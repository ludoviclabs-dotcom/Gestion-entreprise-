/* Jeu d'icônes par secteur (ligne, 24×24, stroke = currentColor).
   Une identité visuelle propre à chaque catégorie. */
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  // Banque, paiement & finance — fronton à colonnes
  "banque-finance": (
    <g>
      <path d="M3 9.5 12 4 21 9.5" />
      <path d="M4 20h16" />
      <path d="M6 11v8M10 11v8M14 11v8M18 11v8" />
    </g>
  ),
  // Immobilier & gestion d'actifs — immeuble
  immobilier: (
    <g>
      <rect x="6" y="3" width="12" height="18" rx="1.6" />
      <path d="M6 9h12M6 13h12" />
      <path d="M10 21v-3.5h4V21" />
    </g>
  ),
  // Experts-comptables, audit & conseil — presse-papier validé
  "experts-comptables-audit": (
    <g>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
      <rect x="9" y="2.5" width="6" height="3.2" rx="1" />
      <path d="M9 13l2 2 4-4.5" />
    </g>
  ),
  // Achats fournisseurs & third-party — colis 3D
  "achats-fournisseurs": (
    <g>
      <path d="M12 3 20 7v10l-8 4-8-4V7Z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </g>
  ),
  // Secteur public & commande publique — balance
  "secteur-public": (
    <g>
      <path d="M12 5v15" />
      <path d="M8 20h8" />
      <path d="M5 8h14" />
      <circle cx="12" cy="4.4" r="1.2" />
      <path d="M5 8 3 13h4Z" />
      <path d="M19 8l-2 5h4Z" />
    </g>
  ),
  // Transport, logistique & commerce international — globe
  "transport-logistique": (
    <g>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3.2 12h17.6M4.8 7.5h14.4M4.8 16.5h14.4" />
    </g>
  ),
  // Santé, pharma & medtech — croix médicale
  "sante-pharma": (
    <g>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </g>
  ),
  // BTP, énergie & commodities — casque de chantier
  "btp-commodities": (
    <g>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M2.5 16.6h19" />
      <path d="M8 16.6v2.4h8v-2.4" />
      <path d="M10 8.4h4" />
    </g>
  ),
};

export function SectorIcon({ slug, size = 28 }: { slug: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[slug] ?? PATHS.immobilier}
    </svg>
  );
}

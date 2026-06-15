/* =========================================================================
   KYB Graph — Scoring Secteurs 2026 (DÉMONSTRATION)
   ---------------------------------------------------------------------------
   Augmente les profils qualitatifs réels (`sector-threats.ts`) d'un modèle de
   scoring (5 dimensions, 0-100) servant uniquement à alimenter les
   infographies de la page /secteurs (radar, heatmap, constellation, jauges).

   ⚠️ Ces scores sont une SYNTHÈSE DE DÉMONSTRATION dérivée des textes — ils ne
   sont PAS calculés depuis un dossier réel et doivent être calibrés avec des
   analystes. La page les présente explicitement comme tels. Aucune conclusion
   automatique : KYB Graph documente des signaux, la décision reste humaine.
   ========================================================================= */
import {
  SECTOR_THREAT_PROFILES,
  type SectorThreatProfile,
} from "./sector-threats";

export type DimensionKey = "geo" | "struct" | "sanctions" | "ubo" | "cyber";

export type Dimension = {
  key: DimensionKey;
  label: string;
  short: string;
  desc: string;
};

export const DIMENSIONS: Dimension[] = [
  {
    key: "geo",
    label: "Risque géographique",
    short: "Géo",
    desc: "Flux transfrontières, juridictions sensibles, intermédiaires étrangers.",
  },
  {
    key: "struct",
    label: "Complexité structurelle",
    short: "Structure",
    desc: "Holdings en cascade, sociétés interposées, montages multi-niveaux.",
  },
  {
    key: "sanctions",
    label: "Exposition sanctions / PEP",
    short: "Sanctions",
    desc: "Proximité de graphe vers gels, listes officielles, personnes exposées.",
  },
  {
    key: "ubo",
    label: "Opacité du bénéficiaire",
    short: "UBO",
    desc: "Écart UBO déclaré / recalculé, détention indirecte, masquage.",
  },
  {
    key: "cyber",
    label: "Risque cyber & supply-chain",
    short: "Cyber",
    desc: "Ransomware, dépendance fournisseurs critiques, compromission tiers.",
  },
];

/** Patterns de chaîne de contrôle illustratifs (mini-schéma par secteur). */
export type SectorPattern = "cascade" | "loop" | "pivot" | "fan" | "chain";

type Scoring = {
  n: string;
  family: string;
  pattern: SectorPattern;
  scores: Record<DimensionKey, number>;
};

/** Scoring de démonstration par slug (aligné sur les 8 profils réels). */
const SCORING: Record<string, Scoring> = {
  "banque-finance": {
    n: "01",
    family: "Finance & patrimoine",
    pattern: "cascade",
    scores: { geo: 75, struct: 85, sanctions: 92, ubo: 80, cyber: 55 },
  },
  immobilier: {
    n: "02",
    family: "Finance & patrimoine",
    pattern: "loop",
    scores: { geo: 55, struct: 90, sanctions: 60, ubo: 92, cyber: 35 },
  },
  "experts-comptables-audit": {
    n: "03",
    family: "Professions régulées",
    pattern: "pivot",
    scores: { geo: 45, struct: 70, sanctions: 55, ubo: 75, cyber: 50 },
  },
  "achats-fournisseurs": {
    n: "04",
    family: "Supply-chain & tiers",
    pattern: "fan",
    scores: { geo: 65, struct: 60, sanctions: 60, ubo: 65, cyber: 90 },
  },
  "secteur-public": {
    n: "05",
    family: "Public & international",
    pattern: "pivot",
    scores: { geo: 50, struct: 65, sanctions: 70, ubo: 70, cyber: 60 },
  },
  "transport-logistique": {
    n: "06",
    family: "Public & international",
    pattern: "chain",
    scores: { geo: 92, struct: 75, sanctions: 88, ubo: 70, cyber: 65 },
  },
  "sante-pharma": {
    n: "07",
    family: "Supply-chain & tiers",
    pattern: "fan",
    scores: { geo: 60, struct: 65, sanctions: 50, ubo: 60, cyber: 92 },
  },
  "btp-commodities": {
    n: "08",
    family: "Public & international",
    pattern: "cascade",
    scores: { geo: 80, struct: 80, sanctions: 78, ubo: 75, cyber: 55 },
  },
};

/** Intensité 2026 = moyenne pondérée des dimensions. */
const WEIGHTS: Record<DimensionKey, number> = {
  geo: 0.9,
  struct: 1,
  sanctions: 1.2,
  ubo: 1.1,
  cyber: 0.9,
};
function intensity(scores: Record<DimensionKey, number>): number {
  let num = 0;
  let den = 0;
  for (const k of Object.keys(WEIGHTS) as DimensionKey[]) {
    num += scores[k] * WEIGHTS[k];
    den += WEIGHTS[k];
  }
  return Math.round(num / den);
}

export type SectorView = SectorThreatProfile & Scoring & { intensity: number };

/** Vue secteur = profil réel + scoring de démonstration + intensité. */
export const SECTORS: SectorView[] = SECTOR_THREAT_PROFILES.map((p) => {
  const sc = SCORING[p.slug];
  return { ...p, ...sc, intensity: intensity(sc.scores) };
});

export const FAMILIES: string[] = [...new Set(SECTORS.map((s) => s.family))];

export type Connector = { key: string; label: string; live: boolean };

/** Connecteurs / sources (repris du SourceHealthStrip : INPI/RNE en démo). */
export const CONNECTORS: Connector[] = [
  { key: "insee", label: "INSEE Sirene", live: true },
  { key: "bodacc", label: "BODACC", live: true },
  { key: "tresor", label: "DG Trésor — gels", live: true },
  { key: "opensanctions", label: "OpenSanctions", live: true },
  { key: "inpi", label: "INPI / RNE", live: false },
  { key: "neon", label: "Base de données (Neon)", live: true },
];

/* ── Palette (teal de marque + palette de risque, alignée landing-scope) ── */
export const PALETTE = {
  bg0: "#0a0b14",
  bg1: "#0e1020",
  bg2: "#14172b",
  line: "#1e2238",
  accent: "#15c2b8",
  accentSoft: "#5fe3d6",
  accentDeep: "#0ea5a3",
  textHi: "#f4f5fb",
  textMid: "#a4a9c4",
  textLow: "#6b7095",
} as const;

export function scoreColor(v: number): string {
  if (v >= 78) return "#f26d6d"; // critique
  if (v >= 64) return "#ff9248"; // élevé
  if (v >= 48) return "#f5b544"; // modéré
  return "#4ade9b"; // maîtrisé
}
export function scoreLabel(v: number): string {
  if (v >= 78) return "Critique";
  if (v >= 64) return "Élevé";
  if (v >= 48) return "Modéré";
  return "Maîtrisé";
}

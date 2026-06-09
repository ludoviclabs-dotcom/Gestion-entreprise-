/**
 * Données de démonstration du mockup interactif (landing). Fixtures fictives
 * mais cohérentes avec le dossier « Holding Patrimoniale ». Aucun JSX / hook —
 * importable depuis les îlots client. Couleurs en tokens `--kyb-*`.
 */

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Database,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  Settings,
} from "lucide-react";

export type Section =
  | "dashboard"
  | "dossiers"
  | "analyses"
  | "alertes"
  | "sources"
  | "parametres";

export type Tab = "Graphe" | "Preuve" | "Sources" | "Scores" | "Analyse";

export const DOSSIER_TABS: Tab[] = [
  "Graphe",
  "Preuve",
  "Sources",
  "Scores",
  "Analyse",
];

export interface NavSection {
  id: Section;
  label: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: NavSection[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "dossiers", label: "Dossiers", icon: FolderOpen },
  { id: "analyses", label: "Analyses", icon: LineChart },
  { id: "alertes", label: "Alertes", icon: Bell },
  { id: "sources", label: "Sources", icon: Database },
  { id: "parametres", label: "Paramètres", icon: Settings },
];

/** Tons sémantiques harmonisés → couleur (token --kyb-*). */
export type Tone = "positive" | "info" | "warning" | "danger" | "neutral";

export const TONE_COLOR: Record<Tone, string> = {
  positive: "var(--kyb-green)",
  info: "var(--kyb-violet-soft)",
  warning: "var(--kyb-amber)",
  danger: "var(--kyb-orange)",
  neutral: "var(--kyb-text-mid)",
};

// ── Fiche entité (onglet Graphe / synthèse) ──────────────────────────────────
export interface EntitySummary {
  label: string;
  type: string;
  siren: string;
  score: number;
  links: number;
  statut: string;
  pays: string;
  resume: string;
}

export const ENTITY_SUMMARIES: Record<string, EntitySummary> = {
  holding: { label: "HOLDING PATRIMONIALE SAS", type: "Société", siren: "900 111 222", score: 78, links: 9, statut: "Active", pays: "France", resume: "Structure complexe avec liens personnes et correspondances. Vérifications complémentaires recommandées." },
  jean: { label: "Jean MARTIN", type: "Personne", siren: "—", score: 62, links: 3, statut: "Dirigeant actif", pays: "France", resume: "Dirige plusieurs entités liées ; rôle exact sur la chaîne de détention à confirmer." },
  sci1: { label: "SCI LES TILLEULS", type: "Société", siren: "812 444 901", score: 71, links: 2, statut: "Active", pays: "France", resume: "SCI détenue par la holding ; cohérence d'adresse et de gérance à vérifier." },
  sci2: { label: "SCI DU PARC", type: "Société", siren: "799 220 118", score: 69, links: 3, statut: "Active", pays: "France", resume: "SCI liée à un événement BODACC à qualifier." },
  addr: { label: "8 avenue du Parc, 69006 Lyon", type: "Adresse", siren: "—", score: 90, links: 2, statut: "Confirmée", pays: "France", resume: "Adresse partagée par plusieurs entités du dossier." },
  rcs: { label: "Immatriculation RCS", type: "Source officielle", siren: "—", score: 88, links: 1, statut: "Vérifiée", pays: "France", resume: "Immatriculation confirmée au registre du commerce et des sociétés." },
  corr: { label: "« MARTIN HOLDING LTD »", type: "Correspondance étrangère", siren: "—", score: 34, links: 1, statut: "À vérifier", pays: "Étranger", resume: "Correspondance de nom avec une entité étrangère ; proximité de graphe à qualifier avant toute conclusion." },
  bod: { label: "Jugement (BODACC)", type: "Événement", siren: "—", score: 55, links: 1, statut: "À qualifier", pays: "France", resume: "Annonce BODACC détectée ; nature et portée à documenter." },
};

// ── Onglet Preuve ────────────────────────────────────────────────────────────
export interface EvidenceItem {
  label: string;
  tone: Tone;
  statusLabel: string;
  timestamp: string;
  source: string;
  confidence: string;
}

export const EVIDENCE_ITEMS: EvidenceItem[] = [
  { label: "Immatriculation RCS vérifiée", tone: "positive", statusLabel: "Vérifié", timestamp: "28/05/2026 · 09:14", source: "Infogreffe / RCS", confidence: "Élevée" },
  { label: "Extrait BODACC détecté", tone: "info", statusLabel: "Source officielle", timestamp: "28/05/2026 · 09:15", source: "BODACC", confidence: "Élevée" },
  { label: "Adresse 8 avenue du Parc confirmée", tone: "positive", statusLabel: "Vérifié", timestamp: "28/05/2026 · 09:16", source: "INSEE Sirene", confidence: "Élevée" },
  { label: "Correspondance « MARTIN HOLDING LTD »", tone: "danger", statusLabel: "À vérifier", timestamp: "28/05/2026 · 09:17", source: "Proximité de graphe", confidence: "Faible" },
  { label: "Jugement judiciaire (BODACC)", tone: "warning", statusLabel: "À qualifier", timestamp: "28/05/2026 · 09:18", source: "BODACC", confidence: "Moyenne" },
];

// ── Onglet Sources ────────────────────────────────────────────────────────────
export interface SourceDetail {
  name: string;
  tone: Tone;
  badge: string;
  freshness: string;
  reliability: string;
  lastCheck: string;
}

export const SOURCE_DETAILS: SourceDetail[] = [
  { name: "RCS / Infogreffe", tone: "positive", badge: "Officiel", freshness: "Temps réel", reliability: "Élevée", lastCheck: "28/05/2026" },
  { name: "INSEE Sirene", tone: "positive", badge: "Officiel", freshness: "< 24 h", reliability: "Élevée", lastCheck: "28/05/2026" },
  { name: "BODACC", tone: "info", badge: "Officiel", freshness: "< 24 h", reliability: "Élevée", lastCheck: "28/05/2026" },
  { name: "Registre des bénéficiaires effectifs", tone: "warning", badge: "À rafraîchir", freshness: "> 30 jours", reliability: "Moyenne", lastCheck: "21/04/2026" },
  { name: "Correspondances internationales", tone: "danger", badge: "Contradiction possible", freshness: "Variable", reliability: "Faible", lastCheck: "12/05/2026" },
];

// ── Onglet Scores ─────────────────────────────────────────────────────────────
export interface ScoreFactor {
  label: string;
  value: number;
  levelLabel: string;
  tone: Tone;
}

export const SCORE_TOTAL = 78;

export const SCORE_FACTORS: ScoreFactor[] = [
  { label: "Complexité structurelle", value: 72, levelLabel: "Élevée", tone: "warning" },
  { label: "Opacité de propriété", value: 55, levelLabel: "Moyenne", tone: "warning" },
  { label: "Exposition personne physique", value: 48, levelLabel: "Moyenne", tone: "warning" },
  { label: "Risque pays", value: 22, levelLabel: "Faible", tone: "positive" },
  { label: "Qualité des sources", value: 83, levelLabel: "Bonne", tone: "positive" },
];

export const SCORE_TODO: string[] = [
  "Correspondance étrangère à qualifier",
  "Jugement BODACC à documenter",
];

// ── Onglet Analyse ────────────────────────────────────────────────────────────
export const ANALYSIS_SYNTHESIS: string[] = [
  "La structure présente plusieurs liens patrimoniaux et immobiliers : une holding et deux SCI partageant adresse et gérance.",
  "Une correspondance internationale (« MARTIN HOLDING LTD ») doit être qualifiée avant toute validation complète.",
  "Le score pourra être amélioré une fois les sources BODACC et le registre des bénéficiaires effectifs confirmés.",
];

export const ANALYSIS_ACTIONS: string[] = [
  "Vérifier la correspondance « MARTIN HOLDING LTD »",
  "Confirmer le rôle de Jean MARTIN",
  "Documenter la source du jugement judiciaire",
  "Exporter le dossier de preuve",
];

// ── Section Tableau de bord ───────────────────────────────────────────────────
export interface Kpi {
  label: string;
  value: string;
  tone?: Tone;
}

export const KPIS: Kpi[] = [
  { label: "Entités cartographiées", value: "7" },
  { label: "Liens détectés", value: "9" },
  { label: "Sources officielles", value: "4", tone: "positive" },
  { label: "Points à vérifier", value: "2", tone: "warning" },
  { label: "Score moyen", value: "78 / 100", tone: "info" },
];

export interface RecentDossier {
  name: string;
  siren: string;
  score: number;
}

export const RECENT_DOSSIERS: RecentDossier[] = [
  { name: "Holding Patrimoniale — démonstration", siren: "900 111 222", score: 78 },
  { name: "Groupe Meridian Invest", siren: "843 220 117", score: 64 },
  { name: "Atlas Logistics SAS", siren: "812 559 003", score: 81 },
];

// ── Section Analyses ──────────────────────────────────────────────────────────
export type Priority = "faible" | "moyenne" | "élevée";

export const PRIORITY_TONE: Record<Priority, Tone> = {
  faible: "neutral",
  moyenne: "warning",
  élevée: "danger",
};

export interface AnalysisItem {
  label: string;
  desc: string;
  priority: Priority;
}

export const ANALYSES: AnalysisItem[] = [
  { label: "Structure patrimoniale", desc: "Holding et SCI imbriquées, chaîne de détention à trois niveaux.", priority: "moyenne" },
  { label: "Correspondance internationale", desc: "Proximité de nom avec une entité étrangère à qualifier.", priority: "élevée" },
  { label: "Signaux BODACC", desc: "Annonce judiciaire détectée sur une entité liée.", priority: "moyenne" },
  { label: "Exposition bénéficiaire effectif", desc: "Donnée registre incomplète sur un bénéficiaire effectif.", priority: "faible" },
];

// ── Section Alertes ───────────────────────────────────────────────────────────
export type Severity = "faible" | "moyenne" | "élevée";

export interface AlertItem {
  label: string;
  desc: string;
  severity: Severity;
}

export const ALERTS: AlertItem[] = [
  { label: "Correspondance étrangère à vérifier", desc: "« MARTIN HOLDING LTD » — proximité de graphe non confirmée.", severity: "élevée" },
  { label: "Jugement judiciaire BODACC à qualifier", desc: "Nature et portée de l'annonce à documenter.", severity: "moyenne" },
  { label: "Source bénéficiaire effectif incomplète", desc: "Registre des bénéficiaires effectifs manquant ou périmé.", severity: "moyenne" },
];

// ── Section Sources (vue globale) ─────────────────────────────────────────────
export type ConnState = "connected" | "available" | "missing";

export const CONN_TONE: Record<ConnState, Tone> = {
  connected: "positive",
  available: "warning",
  missing: "danger",
};

export interface GlobalSource {
  name: string;
  state: ConnState;
  detail: string;
}

export const GLOBAL_SOURCES: GlobalSource[] = [
  { name: "RCS / Infogreffe", state: "connected", detail: "Connecté · temps réel" },
  { name: "INSEE Sirene", state: "connected", detail: "Connecté · < 24 h" },
  { name: "BODACC", state: "connected", detail: "Connecté · < 24 h" },
  { name: "Registre des bénéficiaires effectifs", state: "available", detail: "Disponible · à rafraîchir" },
  { name: "Sources internationales", state: "missing", detail: "Non connecté · démonstration" },
];

// ── Section Paramètres ────────────────────────────────────────────────────────
export interface SettingItem {
  label: string;
  desc: string;
  enabled: boolean;
}

export const SETTINGS: SettingItem[] = [
  { label: "Mode démonstration", desc: "Données fictives, aucune connexion externe.", enabled: true },
  { label: "Confidentialité renforcée", desc: "Données chiffrées, accès journalisé.", enabled: true },
  { label: "Export activé", desc: "Export PDF / PNG des dossiers de preuve.", enabled: true },
  { label: "Conservation des preuves", desc: "Horodatage et chaîne de preuve conservés.", enabled: true },
  { label: "Revue analyste obligatoire", desc: "Validation humaine requise avant conclusion.", enabled: false },
];

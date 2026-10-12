/**
 * Contenus éditoriaux du landing (communs aux directions jour / nuit).
 * Sources : README, docs/regulatory.md, docs/sovereignty.md, docs/risk-rules.md.
 */

import { familySummaries, sourcesIntro } from "@/lib/domain/public-sources";
import type { Proof } from "./data";

export const PILLARS = [
  { title: "Traçabilité complète", text: "Chaîne de preuve horodatée" },
  { title: "Cadre réglementaire", text: "Aligné LCB-FT, RGPD et normes internes" },
  { title: "Analyse approfondie", text: "Graphes relationnels et signaux contextuels" },
  { title: "Contrôle et confidentialité", text: "Données sécurisées, accès maîtrisés" },
];

export const PROOF_LEVELS: { id: Proof; label: string; verify?: boolean; text: string }[] = [
  { id: "confirme", label: "Confirmé", text: "Établi par une source officielle : registre, annonce légale, liste publique." },
  { id: "declare", label: "Déclaré", text: "Déclaré par l'entité ou inscrit dans un registre déclaratif, sans recoupement indépendant." },
  { id: "infere", label: "Inféré", verify: true, text: "Déduit de la structure du graphe : proximité, homonymie, adresse partagée." },
  { id: "simule", label: "Simulé", verify: true, text: "Hypothèse de travail ou donnée de démonstration, sans valeur de fait." },
];

export const PROOF_INTRO =
  "Chaque nœud, lien, événement et signal porte un niveau de preuve. Un élément inféré ou simulé porte toujours la mention « à vérifier ».";

/**
 * Section « Sources » : une ligne par famille, calculée à partir du catalogue
 * public (`src/lib/domain/public-sources.ts`). Aucune liste à tenir à jour ici.
 */
export const SOURCES = familySummaries().map((f) => ({
  name: f.title,
  text: f.names,
  access:
    f.inProgress > 0
      ? `${f.active} actives · ${f.inProgress} en cours`
      : f.partial > 0
        ? `${f.active} ${f.active > 1 ? "sources" : "source"} · disponibilité partielle`
        : `${f.active} ${f.active > 1 ? "sources" : "source"}`,
}));

export const SOURCES_TITLE = "Sources publiques";

export const SOURCES_INTRO = sourcesIntro();

export const SOURCES_LINK = { label: "Voir toutes les sources", href: "/sources" };

export const SCORES = [
  { name: "Complexité", text: "Score structurel : densité du réseau, nombre d'entités, degré maximal." },
  { name: "Vigilance", text: "Somme pondérée des signaux détectés, chacun expliqué par une phrase lisible." },
  { name: "Qualité de preuve", text: "Part des nœuds, liens et événements confirmés ou déclarés." },
];

export const SCORES_INTRO =
  "Le produit ne qualifie jamais une structure de « frauduleuse ». Il parle de complexité, de vigilance et de qualité de preuve.";

export const SCORE_MODEL = "Modèle de score kyb-risk-2026.2";

/** m = modéré, e = élevé, c = critique. */
export type Threat = "m" | "e" | "c";

export const THREAT_HEAD = ["Secteur", "Risque pays", "Complexité structurelle", "Exposition PEP", "Opacité propriété", "Intensité 2026"];

export const THREAT_ROWS: { sector: string; scope: string; cells: Threat[]; intensity: "Élevée" | "Critique" }[] = [
  { sector: "Immobilier", scope: "Transaction & gestion", cells: ["e", "e", "m", "e"], intensity: "Élevée" },
  { sector: "Commerce international", scope: "Import / Export", cells: ["c", "e", "m", "c"], intensity: "Critique" },
  { sector: "Banque & finance", scope: "Entrée en relation", cells: ["m", "c", "c", "e"], intensity: "Élevée" },
  { sector: "Achats fournisseurs", scope: "Supply chain critique", cells: ["c", "m", "e", "c"], intensity: "Critique" },
];

export const THREAT_INTRO =
  "Vue synthétique des niveaux de menaces observés par secteur d'activité pour orienter la priorisation des contrôles et la couverture des diligences.";

/** `future` : échéance postérieure au marqueur « Aujourd'hui ». */
export const TIMELINE = [
  { year: "2022", date: "22 novembre", text: "Arrêt CJUE C-37/20 et C-601/20 : l'accès au registre des bénéficiaires effectifs est conditionné à un intérêt légitime." },
  { year: "2024", date: "31 mai", text: "Signature du règlement (UE) 2024/1624, dit AMLR : un corpus anti-blanchiment unique pour l'Union." },
  { year: "2025", date: "Mi-2025", text: "L'AMLA, autorité européenne de lutte contre le blanchiment, devient opérationnelle à Francfort." },
  { year: "2027", date: "10 juillet", text: "AMLR directement applicable. Seuil du bénéficiaire effectif harmonisé à 25 % ou plus.", future: true },
  { year: "2028", date: "À compter de", text: "Supervision directe par l'AMLA des entités à risque transfrontière.", future: true },
];

/**
 * Position du marqueur « Aujourd'hui » sur la frise horizontale (1a), en % de
 * largeur. Placé à la main (octobre 2026) — les colonnes ne sont pas à
 * l'échelle du temps. À déplacer quand on franchit juillet 2027.
 */
export const TODAY_POS = "52.5%";

export const COMPLIANCE = "Conforme LCB-FT · AMLR 2024/1624 · RGPD";

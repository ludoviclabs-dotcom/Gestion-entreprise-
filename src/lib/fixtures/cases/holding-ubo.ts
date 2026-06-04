import type { CaseBundle, CaseEdge, CaseEntity } from "@/lib/graph/graph-types";

/**
 * Dossier de démonstration du moteur UBO : chaîne d'actionnariat
 * personnes → holdings → société sujet, illustrant trois mécanismes distincts
 * de bénéficiaire effectif, un écart registre/capital, la validité temporelle
 * des arêtes et un diff d'évolution T0 → T1.
 *
 * Sujet : OPTIMA FRANCE SAS (s). Capital : h1 49 % + hc 51 %.
 *  - Hélène MOREAU (pa) : 60 % de h1 → 29,4 % effectif → UBO simple (≥ 25 %).
 *  - Karim BENALI (pb) : 40 % de h1 (19,6 %) + 49 % de hb→hc (12,7 %)
 *      → 32,3 % par chemins PARALLÈLES (aucun ≥ 25 % seul).
 *  - Sofia HADDAD (pc) : 51 % de hb → 51 % de hc → 51 % de s : 13,3 % effectif
 *      mais CONTRÔLE majoritaire à chaque étage → UBO par contrôle (< 25 %).
 *  - co-détenteur minoritaire (pf) : 24,99 % → sous le seuil, non UBO.
 *
 * Écart : le registre déclare MOREAU, HADDAD et un nominee (Vincent LEROY,
 * absent du capital) mais OMET BENALI (UBO réel fragmenté) → 2 divergences.
 */
const entities: CaseEntity[] = [
  {
    id: "s",
    type: "company",
    label: "OPTIMA FRANCE SAS",
    evidenceLevel: "confirmed",
    attributes: {
      SIREN: "908 765 432",
      "Forme juridique": "SAS",
      "Activité (NAF)": "4690Z — Commerce de gros",
      État: "Active",
    },
    source: "INSEE Sirene — unité légale",
  },
  {
    id: "h1",
    type: "company",
    label: "OPTIMA HOLDING SAS",
    evidenceLevel: "confirmed",
    attributes: { SIREN: "907 111 222", "Forme juridique": "SAS", "Activité (NAF)": "6420Z — Holding", État: "Active" },
    source: "INSEE Sirene — unité légale",
  },
  {
    id: "hc",
    type: "company",
    label: "PATRIMOINE CONTROL SARL",
    evidenceLevel: "confirmed",
    attributes: { SIREN: "907 333 444", "Forme juridique": "SARL", "Activité (NAF)": "6420Z — Holding", État: "Active" },
    source: "INSEE Sirene — unité légale",
  },
  {
    id: "hb",
    type: "company",
    label: "BENALI INVEST SAS",
    evidenceLevel: "declared",
    attributes: { SIREN: "907 555 666", "Forme juridique": "SAS", État: "Active" },
    source: "INPI / RNE",
  },
  {
    id: "pa",
    type: "person",
    label: "Hélène MOREAU",
    evidenceLevel: "declared",
    attributes: { Nationalité: "Française" },
    source: "INPI / RNE — registre des bénéficiaires effectifs",
  },
  { id: "pb", type: "person", label: "Karim BENALI", evidenceLevel: "declared", attributes: { Nationalité: "Française" }, source: "INPI / RNE" },
  { id: "pc", type: "person", label: "Sofia HADDAD", evidenceLevel: "declared", attributes: { Nationalité: "Française" }, source: "INPI / RNE" },
  { id: "pf", type: "person", label: "Olivier PETIT", evidenceLevel: "declared", attributes: { Nationalité: "Française" }, source: "INPI / RNE" },
];

const edges: CaseEdge[] = [
  // Capital de la société sujet.
  { id: "u1", type: "DETIENT", source: "h1", target: "s", weight: "49 %", label: "détient 49 %", evidenceLevel: "declared" },
  { id: "u2", type: "DETIENT", source: "hc", target: "s", weight: "51 %", label: "détient 51 %", evidenceLevel: "declared" },
  // Capital de OPTIMA HOLDING (h1) — MOREAU a renforcé sa participation (cf. diff).
  { id: "u3", type: "DETIENT", source: "pa", target: "h1", weight: "60 %", label: "détient 60 %", evidenceLevel: "declared", validFrom: "2024-03-15" },
  { id: "u4", type: "DETIENT", source: "pb", target: "h1", weight: "40 %", label: "détient 40 %", evidenceLevel: "declared" },
  // Capital de PATRIMOINE CONTROL (hc).
  { id: "u5", type: "DETIENT", source: "hb", target: "hc", weight: "51 %", label: "détient 51 %", evidenceLevel: "declared" },
  { id: "u6", type: "DETIENT", source: "pf", target: "hc", weight: "49 %", label: "détient 49 %", evidenceLevel: "declared" },
  // Capital de BENALI INVEST (hb) — détention fragmentée récente (cf. diff).
  { id: "u7", type: "DETIENT", source: "pc", target: "hb", weight: "51 %", label: "détient 51 %", evidenceLevel: "declared" },
  { id: "u8", type: "DETIENT", source: "pb", target: "hb", weight: "49 %", label: "détient 49 %", evidenceLevel: "inferred", excerpt: "Détention déduite d'indices concordants — à confirmer.", validFrom: "2025-09-01" },
  // Gouvernance.
  { id: "g1", type: "DIRIGE", source: "pa", target: "h1", label: "préside", evidenceLevel: "declared" },
  { id: "g2", type: "DIRIGE", source: "pc", target: "s", label: "préside", evidenceLevel: "declared" },
];

// État antérieur (T0) : MOREAU détenait 50 % (montée à 60 %), BENALI n'avait pas
// encore sa participation fragmentée dans BENALI INVEST, et HADDAD n'était pas
// présidente de la société sujet.
const previousEdges: CaseEdge[] = edges
  .filter((e) => e.id !== "u8" && e.id !== "g2")
  .map((e) =>
    e.id === "u3"
      ? { ...e, weight: "50 %", label: "détient 50 %", validFrom: "2021-06-01" }
      : e,
  );

export const holdingUboBundle: CaseBundle = {
  case: {
    id: "holding-ubo",
    title: "OPTIMA FRANCE — bénéficiaires effectifs",
    rootSiren: "908765432",
    scores: { complexite: 62, vigilance: 58, qualitePreuve: 71 },
  },
  entities,
  edges,
  events: [],
  riskSignals: [
    {
      id: "ecart-ubo-declare-case",
      ruleId: "ECART_UBO_DECLARE",
      severity: "high",
      category: "vigilance",
      explanation:
        "Écart de bénéficiaire effectif : 3 déclaré(s) au registre, 3 recalculé(s) ≥ 25 % depuis le capital, 2 divergence(s). Signalement de divergence de registre attendu (AMLR).",
    },
  ],
  declaredUbo: [
    { label: "Hélène MOREAU", nom: "MOREAU", prenoms: "Hélène", modaliteControle: "Détention directe ≥ 25 %" },
    { label: "Sofia HADDAD", nom: "HADDAD", prenoms: "Sofia", modaliteControle: "Contrôle" },
    { label: "Vincent LEROY", nom: "LEROY", prenoms: "Vincent", modaliteControle: "Déclaré" },
  ],
  previous: { label: "État au 1ᵉʳ janvier 2024", entities, edges: previousEdges },
};

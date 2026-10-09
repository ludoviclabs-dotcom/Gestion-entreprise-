import { z } from "zod";

/**
 * Modèle commun des parcours pédagogiques du Lab (cadrage §8).
 *
 * Distinct du modèle KYB (`CaseBundle`) : une adresse blockchain ou un brevet
 * n'est pas une société dotée d'un SIREN. Les vues (graphe, chronologie,
 * actifs, flux) seront des projections pures d'un même état de scénario.
 *
 * Périmètre MVP volontairement resserré : statut des affirmations, sources et
 * dates de validité. Le versionnage des révisions et la double temporalité
 * complète (validité / connaissance) viendront après les deux démonstrateurs.
 */

// ── Valeurs exactes ───────────────────────────────────────────────────────

/** Décimal sérialisé (« 1250.50 », « 45 ») : jamais de flottant pour un montant. */
export const DecimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Décimal attendu sous forme de chaîne (ex. « 1250.50 »)");

/** Pourcentage exact en chaîne décimale, 0 à 100 (« 38.5 »). */
export const PercentString = DecimalString.refine((v) => {
  const n = Number(v);
  return n >= 0 && n <= 100;
}, "Pourcentage entre 0 et 100");

/** Montant dans une unité donnée : on n'additionne jamais deux unités différentes. */
export const Amount = z.object({
  value: DecimalString,
  /** Code de l'unité (EUR, S-EUR fictif…). */
  unit: z.string().min(1),
});

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date ISO AAAA-MM-JJ");

// ── Sources et statut des affirmations (cadrage §3.2, §2.3) ───────────────

export const SourceKind = z.enum([
  "texte_officiel", // loi, règlement, code
  "publication_autorite", // AMF, ESMA, Tracfin, DGSI, DG Trésor, GAFI…
  "guide", // guide de bonnes pratiques officiel (ANSSI…)
  "documentation_technique", // Bitcoin, Ethereum, GLEIF…
  "etude", // cabinets, think tanks : secondaire
  "presse", // médias : secondaire, oriente une recherche
  "piece_fictive", // pièce inventée pour un scénario
]);
export type SourceKind = z.infer<typeof SourceKind>;

/** Une source primaire établit ; une source secondaire oriente (cadrage §2.3). */
export const PRIMARY_SOURCE_KINDS: readonly SourceKind[] = [
  "texte_officiel",
  "publication_autorite",
  "guide",
  "documentation_technique",
];

export const SourceRecord = z.object({
  id: z.string().min(1),
  kind: SourceKind,
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url().optional(),
  /** Date de publication ou de version, si connue (AAAA, AAAA-MM ou AAAA-MM-JJ). */
  published: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
  consultedOn: IsoDate,
  /** Ce que la source permet d'affirmer, en une phrase. */
  supports: z.string().min(1),
  /** Limites de couverture ou de lecture. */
  limits: z.string().optional(),
});
export type SourceRecord = z.infer<typeof SourceRecord>;

export const Origin = z.enum(["fictive", "reelle"]);

export const ClaimNature = z.enum([
  "fait_documente",
  "allegation",
  "hypothese",
  "information_manquante",
]);
export type ClaimNature = z.infer<typeof ClaimNature>;

export const Verification = z.enum(["non_verifie", "declare", "recoupe", "valide"]);
export type Verification = z.infer<typeof Verification>;

export const Claim = z.object({
  id: z.string().min(1),
  /** Proposition précise (« Le contrat prévoit une licence limitée »). */
  statement: z.string().min(1),
  nature: ClaimNature,
  verification: Verification,
  /** Objets du scénario concernés. */
  about: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});
export type Claim = z.infer<typeof Claim>;

/** Pièce d'un scénario (fictive) ou extrait d'une source réelle. */
export const Evidence = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  origin: Origin,
  /** Source réelle citée, pour un extrait. */
  sourceId: z.string().optional(),
  excerpt: z.string().min(1),
  date: IsoDate.optional(),
});
export type Evidence = z.infer<typeof Evidence>;

// ── Objets du scénario ────────────────────────────────────────────────────

export const ActorKind = z.enum([
  "entreprise",
  "personne",
  "investisseur",
  "prestataire_crypto",
  "banque",
  "prestataire_technique",
  "client",
  "preteur",
  "autorite",
]);

export const Actor = z.object({
  id: z.string().min(1),
  kind: ActorKind,
  name: z.string().min(1),
  roles: z.array(z.string()).default([]),
  /** Pays d'établissement documenté, s'il est pertinent : jamais un indice d'intention. */
  country: z.string().optional(),
  origin: Origin,
});
export type Actor = z.infer<typeof Actor>;

export const ResourceKind = z.enum([
  "compte_bancaire",
  "compte_prestataire",
  "adresse",
  "contrat_intelligent",
  "brevet",
  "logiciel",
  "donnees",
  "procede",
  "contrat",
]);

export const Resource = z.object({
  id: z.string().min(1),
  kind: ResourceKind,
  label: z.string().min(1),
  /** Réseau pour une adresse (une adresse = réseau + identifiant). */
  network: z.string().optional(),
  identifier: z.string().optional(),
  origin: Origin,
});
export type Resource = z.infer<typeof Resource>;

export const RelationKind = z.enum([
  "detention", // capital et/ou votes
  "controle", // droits de contrôle documentés hors capital (pacte, nomination)
  "direction",
  "licence",
  "acces",
  "dependance", // client, fournisseur, prêteur
  "financement",
  "prestation",
  "titulaire_compte", // attribution d'un compte à un acteur
]);
export type RelationKind = z.infer<typeof RelationKind>;

export const Relation = z.object({
  id: z.string().min(1),
  kind: RelationKind,
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  capitalPct: PercentString.optional(),
  votingPct: PercentString.optional(),
  /** Droits particuliers ou périmètre (licence, accès…). */
  rights: z.string().optional(),
  validFrom: IsoDate.optional(),
  validTo: IsoDate.optional(),
  claimIds: z.array(z.string()).default([]),
});
export type Relation = z.infer<typeof Relation>;

export const FinancialLeg = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  amount: Amount,
  role: z.enum(["envoi", "frais", "conversion_entree", "conversion_sortie"]),
});

/** Événement financier à plusieurs jambes ; un lien inconnu reste inconnu. */
export const FinancialEvent = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  occurredOn: IsoDate,
  network: z.string().optional(),
  legs: z.array(FinancialLeg).min(1),
  status: z.enum(["confirme", "en_attente", "inconnu"]),
  claimIds: z.array(z.string()).default([]),
});
export type FinancialEvent = z.infer<typeof FinancialEvent>;

// ── Déroulé pédagogique ───────────────────────────────────────────────────

export const ScenarioStep = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Question posée à l'apprenant à cette étape. */
  question: z.string().min(1),
  /** Pièces révélées à cette étape. */
  reveals: z.array(z.string()).default([]),
  /** Date de l'état affiché (projection temporelle), si l'étape en dépend. */
  asOf: IsoDate.optional(),
  /** Explication attendue, révélée après validation. */
  explanation: z.string().min(1),
});
export type ScenarioStep = z.infer<typeof ScenarioStep>;

export const ScenarioBranch = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  reveals: z.array(z.string()).default([]),
  conclusion: z.string().min(1),
  /** Ce qui reste indécidable même dans cette branche. */
  openQuestions: z.array(z.string()).default([]),
});

export const Scenario = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    title: z.string().min(1),
    /** Tout scénario du MVP est fictif et affiché comme tel. */
    fiction: z.literal(true),
    summary: z.string().min(1),
    actors: z.array(Actor),
    resources: z.array(Resource).default([]),
    relations: z.array(Relation).default([]),
    events: z.array(FinancialEvent).default([]),
    claims: z.array(Claim).default([]),
    evidence: z.array(Evidence).default([]),
    steps: z.array(ScenarioStep).min(1),
    branches: z.array(ScenarioBranch).default([]),
  })
  .superRefine((s, ctx) => {
    const objects = new Set([...s.actors.map((a) => a.id), ...s.resources.map((r) => r.id)]);
    const evidence = new Set(s.evidence.map((e) => e.id));
    const claims = new Set(s.claims.map((c) => c.id));
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path });

    const allIds = [
      ...s.actors,
      ...s.resources,
      ...s.relations,
      ...s.events,
      ...s.claims,
      ...s.evidence,
      ...s.steps,
      ...s.branches,
    ].map((o) => o.id);
    const seen = new Set<string>();
    for (const id of allIds) {
      if (seen.has(id)) issue(`Identifiant en double : ${id}`, ["id"]);
      seen.add(id);
    }

    s.relations.forEach((r, i) => {
      if (!objects.has(r.source)) issue(`Relation ${r.id} : source inconnue ${r.source}`, ["relations", i]);
      if (!objects.has(r.target)) issue(`Relation ${r.id} : cible inconnue ${r.target}`, ["relations", i]);
      if (r.validFrom && r.validTo && r.validFrom > r.validTo)
        issue(`Relation ${r.id} : validFrom postérieur à validTo`, ["relations", i]);
      r.claimIds.forEach((c) => claims.has(c) || issue(`Relation ${r.id} : affirmation inconnue ${c}`, ["relations", i]));
    });
    s.events.forEach((e, i) =>
      e.legs.forEach((l) => {
        if (!objects.has(l.from)) issue(`Événement ${e.id} : origine inconnue ${l.from}`, ["events", i]);
        if (!objects.has(l.to)) issue(`Événement ${e.id} : destination inconnue ${l.to}`, ["events", i]);
      }),
    );
    s.claims.forEach((c, i) => {
      c.evidenceIds.forEach((e) => evidence.has(e) || issue(`Affirmation ${c.id} : pièce inconnue ${e}`, ["claims", i]));
      // Un fait documenté s'appuie toujours sur au moins une pièce.
      if (c.nature === "fait_documente" && c.evidenceIds.length === 0)
        issue(`Affirmation ${c.id} : un fait documenté exige une pièce`, ["claims", i]);
    });
    [...s.steps, ...s.branches].forEach((st, i) =>
      st.reveals.forEach((e) => evidence.has(e) || issue(`${st.id} : pièce révélée inconnue ${e}`, ["steps", i])),
    );
  });
export type Scenario = z.infer<typeof Scenario>;

// ── Parcours et notions ───────────────────────────────────────────────────

export const Notion = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
  /** Ce qu'il ne faut pas en conclure. */
  caution: z.string().optional(),
  /** Sources réelles ; vide = définition pédagogique propre au Lab. */
  sourceIds: z.array(z.string()).default([]),
  /** Date d'application si la notion dépend d'un texte daté. */
  appliesFrom: IsoDate.optional(),
});
export type Notion = z.infer<typeof Notion>;

export const LearningPath = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  /** Question à laquelle le parcours apprend à répondre. */
  question: z.string().min(1),
  intro: z.string().min(1),
  audience: z.array(z.string()).min(1),
  objectives: z.array(z.string()).min(1),
  durationMinutes: z.number().int().positive(),
  /** Nom du démonstrateur fictif. */
  scenarioTitle: z.string().min(1),
  scenarioSummary: z.string().min(1),
  /** Déroulé annoncé (titres des étapes du scénario). */
  outline: z.array(z.object({ title: z.string().min(1), detail: z.string().min(1) })).min(1),
  views: z.array(z.object({ title: z.string().min(1), question: z.string().min(1) })).min(1),
  notions: z.array(Notion).min(1),
  status: z.enum(["disponible", "en_preparation"]),
});
export type LearningPath = z.infer<typeof LearningPath>;

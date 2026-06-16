import type { CaseBundle } from "@/lib/graph/graph-types";
import { SCORE_MODEL_VERSION } from "@/lib/risk/engine";
import { compareDeclaredUbo } from "@/lib/graph/ubo";
import {
  GENESIS_HASH,
  computeEntryHash,
  payloadHash,
} from "./hash-chain";

/**
 * Journal de preuve append-only (Étape 3.4 « audit_logs »).
 *
 * Chaque action significative sur un dossier (création, source consultée,
 * risque calculé, écart UBO, synthèse, export) devient une entrée chaînée
 * par hash. Les payloads sont AGRÉGÉS, jamais nominatifs (garde-fou CJUE) —
 * les données elles-mêmes vivent dans le bundle / source_records.
 */

export type ProofEventKind =
  | "dossier_cree"
  | "source_consultee"
  | "risque_calcule"
  | "ecart_ubo_detecte"
  | "synthese_enregistree"
  | "export_genere"
  | "revue_transition";

export type ProofEvent = {
  id: string;
  caseId: string;
  seq: number; // 1-based, croissant par dossier
  kind: ProofEventKind;
  occurredAt: string; // ISO 8601 — haché verbatim (fidélité d'octets)
  payload: Record<string, unknown>;
  prevHash: string;
  entryHash: string;
};

/** Libellés FR pour l'UI (onglet Sources, panneau UBO). */
export const PROOF_EVENT_LABELS: Record<ProofEventKind, string> = {
  dossier_cree: "Dossier créé",
  source_consultee: "Source consultée",
  risque_calcule: "Risque calculé",
  ecart_ubo_detecte: "Écart UBO détecté",
  synthese_enregistree: "Synthèse enregistrée",
  export_genere: "Export généré",
  revue_transition: "Transition de revue",
};

type ProofEventDraft = {
  caseId: string;
  kind: ProofEventKind;
  occurredAt: string;
  payload: Record<string, unknown>;
};

/**
 * Chaîne une nouvelle entrée après `prev` (ou la genèse si null).
 * L'`id` n'entre pas dans la matière hachée : en BDD il est remplacé par
 * l'uuid de la ligne, en mémoire il reste `<caseId>#<seq>`.
 */
export function chainNext(prev: ProofEvent | null, draft: ProofEventDraft): ProofEvent {
  const seq = prev ? prev.seq + 1 : 1;
  const prevHash = prev ? prev.entryHash : GENESIS_HASH;
  const entryHash = computeEntryHash({
    caseId: draft.caseId,
    seq,
    kind: draft.kind,
    occurredAt: draft.occurredAt,
    payload: draft.payload,
    prevHash,
  });
  return {
    id: `${draft.caseId}#${seq}`,
    caseId: draft.caseId,
    seq,
    kind: draft.kind,
    occurredAt: draft.occurredAt,
    payload: draft.payload,
    prevHash,
    entryHash,
  };
}

/** Source minimale requise pour journaliser une consultation. */
export type JournalSourceInput = {
  source: string;
  endpoint: string;
  httpStatus: number;
  isFixture: boolean;
  raw: unknown;
};

/**
 * Construit la séquence d'entrées de la création d'un dossier :
 * `dossier_cree` → un `source_consultee` par source → `risque_calcule`
 * → `ecart_ubo_detecte` si la règle ECART_UBO_DECLARE s'est déclenchée.
 *
 * Pur et déterministe à `occurredAt` donné — partagé par les deux
 * repositories (fixtures/mémoire et Neon) et par les seeds de démo.
 */
export function buildCreationProofEvents(args: {
  caseId: string;
  bundle: CaseBundle;
  sources: JournalSourceInput[];
  occurredAt: string;
  after?: ProofEvent | null;
}): ProofEvent[] {
  const { caseId, bundle, sources, occurredAt } = args;
  const out: ProofEvent[] = [];
  let prev = args.after ?? null;

  const push = (kind: ProofEventKind, payload: Record<string, unknown>) => {
    prev = chainNext(prev, { caseId, kind, occurredAt, payload });
    out.push(prev);
  };

  push("dossier_cree", {
    titre: bundle.case.title,
    rootSiren: bundle.case.rootSiren,
    entites: bundle.entities.length,
    liens: bundle.edges.length,
    evenements: bundle.events.length,
  });

  for (const src of sources) {
    push("source_consultee", {
      source: src.source,
      endpoint: src.endpoint,
      httpStatus: src.httpStatus,
      isFixture: src.isFixture,
      // Convention source_records (JSON.stringify verbatim) : permet de
      // corroborer cette entrée avec source_records.payload_hash en BDD.
      payloadHash: payloadHash(src.raw),
    });
  }

  push("risque_calcule", {
    reglesDeclenchees: [...new Set(bundle.riskSignals.map((s) => s.ruleId))],
    scores: bundle.case.scores ?? {},
    scoreModelVersion: SCORE_MODEL_VERSION,
  });

  const ecart = bundle.riskSignals.find((s) => s.ruleId === "ECART_UBO_DECLARE");
  if (ecart) {
    // Agrégats uniquement — aucun nom (CJUE 2022). Les comptes structurés
    // (AMLR : signalement des divergences sous 14 jours) + la trace de la
    // source registre quand elle est disponible.
    const comparison = compareDeclaredUbo(bundle);
    const trace = (bundle.declaredUbo ?? []).find((d) => d.sourceEndpoint);
    push("ecart_ubo_detecte", {
      ruleId: ecart.ruleId,
      ...(comparison ?? {}),
      explication: ecart.explanation,
      ...(trace?.sourceEndpoint ? { sourceEndpoint: trace.sourceEndpoint } : {}),
      ...(trace?.sourcePayloadHash
        ? { sourcePayloadHash: trace.sourcePayloadHash }
        : {}),
    });
  }

  return out;
}

/** Résumé d'une entrée pour l'UI (une ligne, non nominatif). */
export function summarizeProofEvent(event: ProofEvent): string {
  const p = event.payload;
  switch (event.kind) {
    case "dossier_cree":
      return `${String(p.titre ?? "")} — ${String(p.entites ?? "?")} entités, ${String(p.liens ?? "?")} liens`;
    case "source_consultee":
      return String(p.endpoint ?? p.source ?? "");
    case "risque_calcule": {
      const regles = Array.isArray(p.reglesDeclenchees) ? p.reglesDeclenchees : [];
      return regles.length > 0
        ? `${regles.length} règle(s) : ${regles.join(", ")}`
        : "Aucune règle déclenchée";
    }
    case "ecart_ubo_detecte":
      return String(p.explication ?? "Écart registre / capital détecté");
    case "synthese_enregistree":
      return `${String(p.longueur ?? "?")} caractères`;
    case "export_genere":
      return `Format ${String(p.format ?? "?")}`;
    case "revue_transition":
      return `Revue : ${String(p.from ?? "?")} → ${String(p.to ?? "?")}${
        p.outcome ? ` (${String(p.outcome)})` : ""
      }`;
  }
}

// ── Axe de REVUE (P4) — orthogonal au statut d'ingestion case_status ──────────
// L'état de revue est une PROJECTION du journal append-only (la dernière
// transition journalisée), pas une colonne : chaque changement est une entrée
// hash-chaînée, donc inviolable et rejouable, et fonctionne en mode démo comme
// en base sans migration.

export type ReviewState = "a_trier" | "en_revue" | "conclu";
export type ReviewOutcome =
  | "vigilance_standard"
  | "vigilance_renforcee"
  | "a_reexaminer";

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  a_trier: "À trier",
  en_revue: "En revue (EDD)",
  conclu: "Conclu",
};
export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  vigilance_standard: "Vigilance standard",
  vigilance_renforcee: "Vigilance renforcée",
  a_reexaminer: "À réexaminer",
};
export const REVIEW_OUTCOMES: ReviewOutcome[] = [
  "vigilance_standard",
  "vigilance_renforcee",
  "a_reexaminer",
];

/** Transitions autorisées. Pas de conclusion sans revue (a_trier↛conclu). */
export const REVIEW_TRANSITIONS: Record<ReviewState, ReviewState[]> = {
  a_trier: ["en_revue"],
  en_revue: ["conclu", "a_trier"],
  conclu: ["en_revue"],
};

/** État de revue courant = dernière transition journalisée (sinon « à trier »). */
export function reviewStateFromEvents(events: ProofEvent[]): ReviewState {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].kind !== "revue_transition") continue;
    const to = events[i].payload.to;
    if (to === "a_trier" || to === "en_revue" || to === "conclu") return to;
  }
  return "a_trier";
}

/**
 * Valide une transition de revue (P4). PUR et testable — réutilisé par la Server
 * Action. Renvoie un message d'erreur, ou `null` si la transition est permise.
 * Garde humaine : conclure exige un `outcome` ; une note de justification (≥ 10
 * caractères) est requise dès que la conclusion ESCALADE (`vigilance_renforcee`)
 * OU que le dossier est en bande de vigilance haute. Jamais d'escalade automatique.
 */
export function reviewTransitionError(args: {
  from: ReviewState;
  to: ReviewState;
  outcome?: ReviewOutcome;
  highBand: boolean;
  noteLength: number;
}): string | null {
  const { from, to, outcome, highBand, noteLength } = args;
  if (!REVIEW_TRANSITIONS[from].includes(to)) {
    return `Transition ${from} → ${to} non autorisée.`;
  }
  if (to === "conclu") {
    if (!outcome || !REVIEW_OUTCOMES.includes(outcome)) {
      return "Choisissez une conclusion de revue.";
    }
    const needNote = highBand || outcome === "vigilance_renforcee";
    if (needNote && noteLength < 10) {
      return "Une note de justification (≥ 10 caractères) est requise pour conclure en vigilance élevée ou en escalade.";
    }
  }
  return null;
}

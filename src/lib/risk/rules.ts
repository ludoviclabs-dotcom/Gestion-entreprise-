import type Graph from "graphology";
import { stronglyConnectedComponents } from "graphology-components";
import type {
  CaseRiskSignal,
  EdgeKind,
  RiskCategory,
  Severity,
} from "@/lib/graph/graph-types";
import type { Rule, RuleContext } from "./types";

// ── Utilitaires partagés ─────────────────────────────────────────────────

function makeSignal(
  ruleId: string,
  subjectId: string | undefined,
  severity: Severity,
  category: RiskCategory,
  explanation: string,
  suffix?: string,
): CaseRiskSignal {
  const key = `${ruleId.toLowerCase().replace(/_/g, "-")}-${subjectId ?? "case"}${
    suffix ? `-${suffix}` : ""
  }`;
  return { id: key, ruleId, subjectId, severity, category, explanation };
}

/** Compte les arêtes d'un type donné sur un nœud, dans la direction donnée. */
function countEdgesOfType(
  graph: Graph,
  node: string,
  type: EdgeKind | "A_PUBLIE",
  direction: "in" | "out",
): number {
  if (!graph.hasNode(node)) return 0;
  const edges = direction === "out" ? graph.outEdges(node) : graph.inEdges(node);
  let n = 0;
  for (const edge of edges) {
    if (graph.getEdgeAttribute(edge, "edgeKind") === type) n += 1;
  }
  return n;
}

/**
 * Parse une date en formats variés rencontrés dans les fixtures et payloads
 * Sirene / INPI : ISO (YYYY-MM-DD), FR (DD/MM/YYYY), partielle (YYYY).
 */
function parseFlexibleDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // ISO complet
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // FR DD/MM/YYYY
  const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (frMatch) {
    return new Date(Date.UTC(+frMatch[3], +frMatch[2] - 1, +frMatch[1]));
  }
  // Année seule
  if (/^\d{4}$/.test(trimmed)) return new Date(Date.UTC(+trimmed, 0, 1));
  return null;
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

// ── 1. DIRIGEANT_MULTI_SOCIETES ──────────────────────────────────────────

export const DIRIGEANT_MULTI_SOCIETES: Rule = {
  id: "DIRIGEANT_MULTI_SOCIETES",
  label: "Dirigeant multi-sociétés",
  category: "complexite",
  evaluate(ctx) {
    const signals: CaseRiskSignal[] = [];
    const { medium, high } = ctx.thresholds.dirigeantMultiSocietes;
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "person") continue;
      const count = countEdgesOfType(ctx.graph, entity.id, "DIRIGE", "out");
      if (count < medium) continue;
      const severity: Severity = count > high ? "high" : "medium";
      signals.push(
        makeSignal(
          this.id,
          entity.id,
          severity,
          this.category,
          `${entity.label} est lié·e à ${count} sociétés du dossier (seuil ${medium}).`,
        ),
      );
    }
    return signals;
  },
};

// ── 2. ADRESSE_PARTAGEE ──────────────────────────────────────────────────

export const ADRESSE_PARTAGEE: Rule = {
  id: "ADRESSE_PARTAGEE",
  label: "Adresse partagée",
  category: "vigilance",
  evaluate(ctx) {
    const signals: CaseRiskSignal[] = [];
    const { medium, high } = ctx.thresholds.adressePartagee;
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "address") continue;
      const count = countEdgesOfType(
        ctx.graph,
        entity.id,
        "PARTAGE_ADRESSE",
        "in",
      );
      if (count < medium) continue;
      const severity: Severity = count > high ? "high" : "medium";
      signals.push(
        makeSignal(
          this.id,
          entity.id,
          severity,
          this.category,
          `${count} sociétés déclarent la même adresse : ${entity.label}.`,
        ),
      );
    }
    return signals;
  },
};

// ── 3. SOCIETE_RECENTE_TRES_LIEE ─────────────────────────────────────────

export const SOCIETE_RECENTE_TRES_LIEE: Rule = {
  id: "SOCIETE_RECENTE_TRES_LIEE",
  label: "Société récente très liée",
  category: "vigilance",
  evaluate(ctx) {
    const signals: CaseRiskSignal[] = [];
    const { months, minDegree } = ctx.thresholds.societeRecenteTresLiee;
    const now = new Date();
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "company") continue;
      const attrs = entity.attributes ?? {};
      const dateRaw =
        attrs["Création"] ?? attrs["Date de création"] ?? attrs["dateCreation"];
      const created = parseFlexibleDate(dateRaw);
      if (!created) continue;
      const elapsed = monthsBetween(created, now);
      if (elapsed > months) continue;
      const degree = ctx.graph.hasNode(entity.id)
        ? ctx.graph.degree(entity.id)
        : 0;
      if (degree < minDegree) continue;
      signals.push(
        makeSignal(
          this.id,
          entity.id,
          "medium",
          this.category,
          `Société créée il y a ${elapsed} mois et déjà fortement reliée (degré ${degree}).`,
        ),
      );
    }
    return signals;
  },
};

// ── 4. PROCEDURE_COLLECTIVE ──────────────────────────────────────────────

export const PROCEDURE_COLLECTIVE: Rule = {
  id: "PROCEDURE_COLLECTIVE",
  label: "Procédure collective",
  category: "vigilance",
  evaluate(ctx) {
    const signals: CaseRiskSignal[] = [];
    let i = 0;
    for (const event of ctx.bundle.events) {
      if (event.kind !== "procedure_collective") continue;
      const date = event.occurredOn ?? "date inconnue";
      signals.push(
        makeSignal(
          this.id,
          event.entityId,
          "high",
          this.category,
          `Procédure collective publiée au BODACC le ${date}.`,
          String(i),
        ),
      );
      i += 1;
    }
    return signals;
  },
};

// ── 5. RADIATION ─────────────────────────────────────────────────────────

export const RADIATION: Rule = {
  id: "RADIATION",
  label: "Radiation du RCS",
  category: "vigilance",
  evaluate(ctx) {
    const signals: CaseRiskSignal[] = [];
    let i = 0;
    for (const event of ctx.bundle.events) {
      if (event.kind !== "radiation") continue;
      const date = event.occurredOn ?? "date inconnue";
      signals.push(
        makeSignal(
          this.id,
          event.entityId,
          "high",
          this.category,
          `Radiation du RCS publiée au BODACC le ${date}.`,
          String(i),
        ),
      );
      i += 1;
    }
    return signals;
  },
};

// ── 6. CYCLE_DETENTION ───────────────────────────────────────────────────

/**
 * Détection de cycles de détention : un cycle dans le sous-graphe `DETIENT`
 * révèle un schéma de structuration capitalistique circulaire (souvent
 * intentionnel, parfois suspect). On extrait les SCC de taille ≥ 2 du
 * sous-graphe filtré.
 */
export const CYCLE_DETENTION: Rule = {
  id: "CYCLE_DETENTION",
  label: "Cycle de détention",
  category: "vigilance",
  evaluate(ctx) {
    // Construire un sous-graphe Graphology ne contenant que les arêtes DETIENT.
    // graphology-components accepte directement un graphe filtré.
    const subgraph = ctx.graph.copy();
    subgraph.forEachEdge((edge, attrs) => {
      if (attrs.edgeKind !== "DETIENT") subgraph.dropEdge(edge);
    });

    let sccs: string[][];
    try {
      sccs = stronglyConnectedComponents(subgraph);
    } catch {
      return [];
    }

    const signals: CaseRiskSignal[] = [];
    let i = 0;
    for (const scc of sccs) {
      if (scc.length < 2) continue;
      const labels = scc
        .map((id) => ctx.bundle.entities.find((e) => e.id === id)?.label ?? id)
        .join(" → ");
      signals.push(
        makeSignal(
          this.id,
          scc[0],
          "high",
          this.category,
          `Cycle de détention détecté entre ${scc.length} sociétés (${labels}).`,
          String(i),
        ),
      );
      i += 1;
    }
    return signals;
  },
};

/** Catalogue par défaut, dans l'ordre d'évaluation. */
export const DEFAULT_RULES: Rule[] = [
  DIRIGEANT_MULTI_SOCIETES,
  ADRESSE_PARTAGEE,
  SOCIETE_RECENTE_TRES_LIEE,
  PROCEDURE_COLLECTIVE,
  RADIATION,
  CYCLE_DETENTION,
];

import type Graph from "graphology";
import { stronglyConnectedComponents } from "graphology-components";
import type {
  CaseRiskSignal,
  EdgeKind,
  RiskCategory,
  Severity,
} from "@/lib/graph/graph-types";
import { computeGraphMetrics } from "@/lib/graph/algorithms";
import { compareDeclaredUbo, parsePct } from "@/lib/graph/ubo";
import { normalizeName, stripLegalForms } from "@/lib/match/normalize";
import { denominationSimilarity } from "@/lib/match/similarity";
import type { Rule } from "./types";

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
export function countEdgesOfType(
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
export function parseFlexibleDate(raw: string | undefined | null): Date | null {
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

export function monthsBetween(from: Date, to: Date): number {
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

// ── 7. PIVOT_SUSPECT (betweenness élevée) ────────────────────────────────

/**
 * Repère les nœuds « pivots » dont la centralité d'intermédiarité (betweenness)
 * est anormalement élevée — ils relient des sous-réseaux qui sinon seraient
 * disjoints. Utile pour repérer un nominee, un dirigeant-paille, ou une
 * entité en position d'intermédiation marquée entre groupes (substance
 * économique à vérifier).
 *
 * Seuil : betweenness normalisée > 0.4 (sur [0, 1]) → signal medium.
 */
export const PIVOT_SUSPECT: Rule = {
  id: "PIVOT_SUSPECT",
  label: "Pivot suspect",
  category: "vigilance",
  evaluate(ctx) {
    if (ctx.bundle.entities.length < 5) return []; // pas pertinent sur petits graphes
    const { betweenness } = ctx.metrics ?? computeGraphMetrics(ctx.graph);
    const signals: CaseRiskSignal[] = [];
    for (const [nodeId, score] of Object.entries(betweenness)) {
      if (score <= 0.4) continue;
      const entity = ctx.bundle.entities.find((e) => e.id === nodeId);
      if (!entity || entity.type === "address" || entity.type === "event") continue;
      signals.push(
        makeSignal(
          "PIVOT_SUSPECT",
          nodeId,
          score > 0.7 ? "high" : "medium",
          "vigilance",
          `${entity.label} occupe une position de pivot inhabituelle (centralité d'intermédiarité ${Math.round(score * 100)} %).`,
        ),
      );
    }
    return signals;
  },
};

// ── 8. ECART_UBO_DECLARE (divergence registre vs capital recalculé) ───────

/**
 * Compare les bénéficiaires effectifs DÉCLARÉS au registre (INPI/RBE, via
 * `bundle.declaredUbo`) avec ceux RECALCULÉS depuis les chaînes de capital
 * (`computeUbo`, seuil 25 % / contrôle majoritaire). Une divergence est un
 * signal de vigilance : l'AMLR (Règlement (UE) 2024/1624) impose justement le
 * signalement des écarts de registre.
 *
 * Le signal reste volontairement AGRÉGÉ (comptes, sans nommer) → conforme au
 * garde-fou CJUE 2022 ; le détail nominatif est réservé au panneau UBO gaté.
 * Ne se déclenche que si une liste déclarée est disponible.
 */
export const ECART_UBO_DECLARE: Rule = {
  id: "ECART_UBO_DECLARE",
  label: "Écart bénéficiaire effectif déclaré / recalculé",
  category: "vigilance",
  evaluate(ctx) {
    // Comparaison factorisée dans le moteur UBO (réutilisée par le journal
    // de preuve pour l'événement `ecart_ubo_detecte`).
    const comparison = compareDeclaredUbo(ctx.bundle);
    if (!comparison || comparison.divergences === 0) return [];

    return [
      makeSignal(
        this.id,
        undefined,
        "high",
        this.category,
        `Écart de bénéficiaire effectif : ${comparison.declares} déclaré(s) au registre, ${comparison.recalcules} recalculé(s) ≥ 25 % depuis le capital, ${comparison.divergences} divergence(s). Signalement de divergence de registre attendu (AMLR).`,
      ),
    ];
  },
};

// ── 9. PROXIMITE_SANCTION (plus court chemin vers un nœud sanction/PEP) ───

/**
 * Mesure la proximité réseau de chaque société/personne à une entité signalée
 * (sanction / PEP) par parcours en largeur (BFS) non dirigé. C'est l'angle
 * que le screening par liste ne donne pas : « cette société est à 2 sauts d'une
 * entité sanctionnée via une adresse partagée ».
 *
 * Seuil : ≤ 2 sauts. Direct (1 saut) → high ; indirect (2 sauts) → medium.
 */
export const PROXIMITE_SANCTION: Rule = {
  id: "PROXIMITE_SANCTION",
  label: "Proximité d'une entité signalée",
  category: "vigilance",
  evaluate(ctx) {
    const MAX_HOPS = 2;
    const sanctions = ctx.bundle.entities.filter((e) => e.type === "sanction");
    if (sanctions.length === 0) return [];

    // Adjacence non dirigée + libellé de l'arête (pour décrire le chemin).
    const adj = new Map<string, { node: string; via: string }[]>();
    const link = (a: string, b: string, label: string) => {
      const list = adj.get(a) ?? [];
      list.push({ node: b, via: label });
      adj.set(a, list);
    };
    for (const e of ctx.bundle.edges) {
      const label = e.label ?? e.type;
      link(e.source, e.target, label);
      link(e.target, e.source, label);
    }

    // BFS multi-source depuis tous les nœuds sanction.
    const dist = new Map<string, number>();
    const pred = new Map<string, { from: string; via: string }>();
    const queue: string[] = [];
    for (const s of sanctions) {
      dist.set(s.id, 0);
      queue.push(s.id);
    }
    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head];
      const d = dist.get(node) ?? 0;
      if (d >= MAX_HOPS) continue;
      for (const { node: next, via } of adj.get(node) ?? []) {
        if (dist.has(next)) continue;
        dist.set(next, d + 1);
        pred.set(next, { from: node, via });
        queue.push(next);
      }
    }

    const labelOf = (id: string) =>
      ctx.bundle.entities.find((e) => e.id === id)?.label ?? id;

    const signals: CaseRiskSignal[] = [];
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "company" && entity.type !== "person") continue;
      const d = dist.get(entity.id);
      if (d === undefined || d < 1 || d > MAX_HOPS) continue;
      const step = pred.get(entity.id);
      const targetLabel = step ? labelOf(step.from) : "une entité signalée";
      const explanation =
        d === 1
          ? `${entity.label} est directement reliée à une entité signalée (sanction/PEP) : ${targetLabel}.`
          : `${entity.label} est à ${d} sauts d'une entité signalée (sanction/PEP), via ${targetLabel}${step ? ` (${step.via})` : ""}.`;
      signals.push(
        makeSignal(
          this.id,
          entity.id,
          d === 1 ? "high" : "medium",
          this.category,
          explanation,
        ),
      );
    }
    return signals;
  },
};

// ── Typologies structurelles (M9) ────────────────────────────────────────
// Reconnaissance de SCHÉMAS par composition de features existantes. Émettent des
// signaux « à vérifier » — jamais une qualification d'infraction. Réutilisent
// ctx.metrics (précalculé) pour ne pas multiplier les passes de graphe.

/**
 * 10. RELAIS_STRUCTUREL — récupère l'intention structurelle de M7 (« société de
 * passage ») SANS données de flux : une société à forte centralité combinée à
 * un indice secondaire (création récente ou adresse partagée) est un relais à la
 * substance à vérifier. Famille « structure ».
 */
export const RELAIS_STRUCTUREL: Rule = {
  id: "RELAIS_STRUCTUREL",
  label: "Relais structurel",
  category: "vigilance",
  evaluate(ctx) {
    if (ctx.bundle.entities.length < 5) return [];
    const { betweenness } = ctx.metrics ?? computeGraphMetrics(ctx.graph);
    const { betweenness: bwSeuil, recentMonths } = ctx.thresholds.relaisStructurel;
    const now = new Date();
    const signals: CaseRiskSignal[] = [];
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "company") continue;
      const bw = betweenness[entity.id] ?? 0;
      if (bw <= bwSeuil) continue;
      const attrs = entity.attributes ?? {};
      const created = parseFlexibleDate(
        attrs["Création"] ?? attrs["Date de création"] ?? attrs["dateCreation"],
      );
      const recent = created ? monthsBetween(created, now) <= recentMonths : false;
      // « Adresse partagée » = la société pointe vers une adresse REELLEMENT
      // partagée (inDegree PARTAGE_ADRESSE ≥ 2), pas simplement « a une adresse »
      // (toute société a un siège). Miroir de CONCENTRATION_DOMICILIATION.
      const sharedAddr =
        ctx.graph.hasNode(entity.id) &&
        ctx.graph.outEdges(entity.id).some((e) => {
          if (ctx.graph.getEdgeAttribute(e, "edgeKind") !== "PARTAGE_ADRESSE")
            return false;
          const addr = ctx.graph.target(e);
          return countEdgesOfType(ctx.graph, addr, "PARTAGE_ADRESSE", "in") >= 2;
        });
      if (!recent && !sharedAddr) continue;
      const indices = [
        recent ? "création récente" : null,
        sharedAddr ? "adresse partagée" : null,
      ]
        .filter(Boolean)
        .join(" + ");
      signals.push(
        makeSignal(
          this.id,
          entity.id,
          "medium",
          this.category,
          `${entity.label} occupe une position de relais (centralité ${Math.round(bw * 100)} %) combinée à ${indices} — substance à vérifier.`,
        ),
      );
    }
    return signals;
  },
};

/**
 * 11. CONCENTRATION_DOMICILIATION — une adresse concentrant plusieurs sociétés
 * dont au moins une récente : domiciliation à vérifier. Renforce ADRESSE_PARTAGEE
 * par le critère d'ancienneté. Famille « adresse ».
 */
export const CONCENTRATION_DOMICILIATION: Rule = {
  id: "CONCENTRATION_DOMICILIATION",
  label: "Concentration de domiciliation",
  category: "vigilance",
  evaluate(ctx) {
    const { minCompanies, recentMonths } =
      ctx.thresholds.concentrationDomiciliation;
    const now = new Date();
    const signals: CaseRiskSignal[] = [];
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "address") continue;
      const count = countEdgesOfType(
        ctx.graph,
        entity.id,
        "PARTAGE_ADRESSE",
        "in",
      );
      if (count < minCompanies) continue;
      const sharers = ctx.bundle.edges
        .filter((e) => e.type === "PARTAGE_ADRESSE" && e.target === entity.id)
        .map((e) => e.source);
      const hasRecent = sharers.some((sid) => {
        const c = ctx.bundle.entities.find(
          (x) => x.id === sid && x.type === "company",
        );
        const a = c?.attributes ?? {};
        const created = parseFlexibleDate(
          a["Création"] ?? a["Date de création"] ?? a["dateCreation"],
        );
        return created ? monthsBetween(created, now) <= recentMonths : false;
      });
      if (!hasRecent) continue;
      signals.push(
        makeSignal(
          this.id,
          entity.id,
          "medium",
          this.category,
          `${count} sociétés domiciliées à la même adresse (${entity.label}), dont au moins une récente — domiciliation à vérifier.`,
        ),
      );
    }
    return signals;
  },
};

/**
 * 12. CHAINE_DETENTION_OPAQUE — des liens de détention sans pourcentage
 * exploitable empêchent de recalculer entièrement la détention effective. C'est
 * une lacune de QUALITÉ DE PREUVE (pas une charge), donc sévérité faible et
 * catégorie qualite_preuve — ne double pas ECART_UBO_DECLARE en vigilance.
 * Famille « capital ».
 */
export const CHAINE_DETENTION_OPAQUE: Rule = {
  id: "CHAINE_DETENTION_OPAQUE",
  label: "Chaîne de détention incomplète",
  category: "qualite_preuve",
  evaluate(ctx) {
    const { minMissing } = ctx.thresholds.chaineDetentionOpaque;
    let missing = 0;
    for (const e of ctx.bundle.edges) {
      if (e.type !== "DETIENT") continue;
      if (parsePct(e.weight) === null) missing += 1;
    }
    if (missing < minMissing) return [];
    return [
      makeSignal(
        this.id,
        undefined,
        "low",
        this.category,
        `${missing} lien(s) de détention sans pourcentage exploitable — la détention effective ne peut être entièrement recalculée.`,
      ),
    ];
  },
};

// ── 13. RESOLUTION_SANCTION (rapprochement nominatif hors lien de graphe) ──

/** Nom affiché d'une entité sanction (« Correspondance « X » » → « X »). */
function sanctionDisplayName(label: string): string {
  const m = /«\s*(.+?)\s*»/.exec(label);
  return m ? m[1] : label;
}
/**
 * Nombre de tokens DISCRIMINANTS (longueur > 1, formes juridiques retirées)
 * partagés entre deux noms. On strippe les formes pour que « ≥ 2 tokens
 * significatifs » exige réellement deux discriminants (pas un sigle générique).
 */
function sharedTokenCount(a: string, b: string): number {
  const setA = new Set(stripLegalForms(a).split(" ").filter((t) => t.length > 1));
  const setB = new Set(stripLegalForms(b).split(" ").filter((t) => t.length > 1));
  let n = 0;
  for (const t of setA) if (setB.has(t)) n += 1;
  return n;
}

/**
 * Rapproche une société/personne d'une entité signalée (sanction/PEP) par
 * IDENTITÉ DE NOM, lorsqu'aucun lien de graphe ne les relie déjà (les paires
 * adjacentes sont couvertes par PROXIMITE_SANCTION). Après résolution
 * d'entités, ferme le faux négatif où un dirigeant porte le nom d'une personne
 * signalée sans arête directe.
 *
 * Garde-fou anti-homonymie : ≥ 2 tokens significatifs partagés ET similarité
 * ≥ 0.92. Le flou est plafonné à `medium` (homonymie probable) ; seul un nom
 * strictement identique après normalisation atteint `high`.
 */
export const RESOLUTION_SANCTION: Rule = {
  id: "RESOLUTION_SANCTION",
  label: "Rapprochement nominatif d'une entité signalée",
  category: "vigilance",
  evaluate(ctx) {
    const sanctions = ctx.bundle.entities.filter((e) => e.type === "sanction");
    if (sanctions.length === 0) return [];

    const adjacent = new Set<string>();
    for (const e of ctx.bundle.edges) {
      adjacent.add(`${e.source}|${e.target}`);
      adjacent.add(`${e.target}|${e.source}`);
    }

    const signals: CaseRiskSignal[] = [];
    let i = 0;
    for (const entity of ctx.bundle.entities) {
      if (entity.type !== "company" && entity.type !== "person") continue;
      for (const s of sanctions) {
        if (adjacent.has(`${entity.id}|${s.id}`)) continue;
        const name = sanctionDisplayName(s.label);
        const sim = denominationSimilarity(entity.label, name);
        if (sim < 0.92 || sharedTokenCount(entity.label, name) < 2) continue;
        // « high » réservé à un nom STRICTEMENT identique après normalisation
        // (sans retirer la forme juridique : une SAS ≠ une LTD). Sinon medium.
        const exact = normalizeName(entity.label) === normalizeName(name);
        signals.push(
          makeSignal(
            this.id,
            entity.id,
            exact ? "high" : "medium",
            this.category,
            `${entity.label} présente un rapprochement nominatif (≈ ${Math.round(
              sim * 100,
            )} %) avec une entité signalée « ${name} ». Homonymie possible — à vérifier sur les identifiants (date de naissance, références UE/ONU).`,
            String(i),
          ),
        );
        i += 1;
      }
    }
    return signals;
  },
};

// ── 14. COUVERTURE_MEDIA_DEFAVORABLE (presse défavorable, faisceau) ──

/**
 * Couverture médiatique DÉFAVORABLE concentrée sur une entité (≥ seuil
 * d'articles à tonalité négative, GDELT). Famille « media ». JAMAIS une
 * conclusion : un signal de faisceau à corroborer humainement — la convergence
 * exige ≥ 2 familles distinctes, donc la presse seule ne déclenche pas d'alerte.
 * Sévérité plafonnée à `medium`.
 */
export const COUVERTURE_MEDIA_DEFAVORABLE: Rule = {
  id: "COUVERTURE_MEDIA_DEFAVORABLE",
  label: "Couverture médiatique défavorable",
  category: "vigilance",
  evaluate(ctx) {
    const { minAdverse } = ctx.thresholds.couvertureMedia;
    const counts = new Map<string, number>();
    for (const ev of ctx.bundle.events) {
      if (ev.kind !== "couverture_media_defavorable") continue;
      counts.set(ev.entityId, (counts.get(ev.entityId) ?? 0) + 1);
    }
    const signals: CaseRiskSignal[] = [];
    let i = 0;
    for (const [entityId, n] of counts) {
      if (n < minAdverse) continue;
      signals.push(
        makeSignal(
          this.id,
          entityId,
          "medium",
          this.category,
          `${n} article(s) de presse à tonalité défavorable rattaché(s) à cette entité — à examiner (jamais une conclusion ; à corroborer par d'autres familles d'indices).`,
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
  PIVOT_SUSPECT,
  ECART_UBO_DECLARE,
  PROXIMITE_SANCTION,
  RELAIS_STRUCTUREL,
  CONCENTRATION_DOMICILIATION,
  CHAINE_DETENTION_OPAQUE,
  RESOLUTION_SANCTION,
  COUVERTURE_MEDIA_DEFAVORABLE,
];

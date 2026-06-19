import type { CaseBundle, CaseEntity } from "@/lib/graph/graph-types";
import { compareDeclaredUbo } from "@/lib/graph/ubo";

/**
 * Facteurs ATTÉNUANTS — garde-fou faux positifs (§8, §10) : afficher les
 * éléments rassurants À CÔTÉ des signaux de vigilance, pour qu'une holding, une
 * filiale ou un pays étranger ne soient jamais « suspects par nature ».
 *
 * Pur et déterministe : calculé à la volée depuis le `bundle` (même pattern que
 * `computeUbo`), jamais persisté, n'altère AUCUN score. Chaque facteur n'est émis
 * que si la donnée qui le fonde est réellement disponible — aucune supposition.
 */
export type MitigatingFactor = {
  /** Identifiant stable (clé de wiring / test). */
  id: string;
  /** Libellé court, factuel, non accusatoire. */
  label: string;
  /** Justification vérifiable du facteur. */
  detail: string;
};

/** Parse ISO (YYYY-MM-DD), FR (DD/MM/YYYY) ou année seule → Date, ou null. */
function parseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (fr) return new Date(Date.UTC(+fr[3], +fr[2] - 1, +fr[1]));
  if (/^\d{4}$/.test(t)) return new Date(Date.UTC(+t, 0, 1));
  return null;
}

/** Société sujet du dossier (racine SIREN, sinon première société). */
function rootCompany(bundle: CaseBundle): CaseEntity | null {
  const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
  const rootDigits = digits(bundle.case.rootSiren);
  const companies = bundle.entities.filter((e) => e.type === "company");
  const root = rootDigits
    ? companies.find((c) => digits(c.attributes?.SIREN) === rootDigits)
    : undefined;
  return root ?? companies[0] ?? null;
}

function rootCompanyCreation(bundle: CaseBundle): Date | null {
  const subject = rootCompany(bundle);
  if (!subject) return null;
  const a = subject.attributes ?? {};
  return parseDate(a["Création"] ?? a["Date de création"] ?? a["dateCreation"]);
}

/**
 * Évalue les facteurs atténuants disponibles pour un dossier.
 * `now` est injectable pour des tests déterministes.
 */
export function computeMitigatingFactors(
  bundle: CaseBundle,
  now: Date = new Date(),
): MitigatingFactor[] {
  const factors: MitigatingFactor[] = [];

  // 1. Concordance des bénéficiaires effectifs (registre ↔ capital recalculé).
  // On exige des comptes égaux EN PLUS de 0 divergence : sinon (homonymes
  // s'effondrant sur une même clé) le détail afficherait « 2 déclaré / 1
  // recalculé / 0 divergence », un contresens pour un facteur « rassurant ».
  const ubo = compareDeclaredUbo(bundle);
  if (ubo && ubo.divergences === 0 && ubo.declares === ubo.recalcules) {
    factors.push({
      id: "UBO_CONCORDANT",
      label: "Bénéficiaires effectifs concordants",
      detail: `Registre et capital recalculé alignés (${ubo.declares} déclaré(s), ${ubo.recalcules} recalculé(s), 0 divergence).`,
    });
  }

  // 2. Base documentaire solide (majorité de liens confirmés ou déclarés).
  const items = [...bundle.entities, ...bundle.edges, ...bundle.events];
  if (items.length > 0) {
    const solid = items.filter(
      (it) =>
        it.evidenceLevel === "confirmed" || it.evidenceLevel === "declared",
    ).length;
    const ratio = solid / items.length;
    if (ratio >= 0.7) {
      factors.push({
        id: "PREUVE_SOLIDE",
        label: "Base documentaire solide",
        detail: `${Math.round(ratio * 100)} % des éléments du dossier sont confirmés ou déclarés (vs inférés/simulés).`,
      });
    }
  }

  // 3. Aucune entité sous sanction / PEP dans le périmètre cartographié.
  const hasSanction = bundle.entities.some((e) => e.type === "sanction");
  if (!hasSanction) {
    factors.push({
      id: "AUCUNE_ENTITE_SIGNALEE",
      label: "Aucune entité signalée",
      detail:
        "Aucune entité sous sanction ou PEP dans le périmètre cartographié.",
    });
  }

  // 4. Aucune procédure collective ni radiation au BODACC sur la période.
  const hasProcedure = bundle.events.some(
    (e) => e.kind === "procedure_collective" || e.kind === "radiation",
  );
  if (!hasProcedure) {
    factors.push({
      id: "PAS_DE_PROCEDURE",
      label: "Pas de procédure collective ni radiation",
      detail:
        "Aucune procédure collective ni radiation publiée au BODACC sur la période couverte.",
    });
  }

  // 5. Ancienneté établie de la société sujet (contre-poids à « société récente »).
  const created = rootCompanyCreation(bundle);
  if (created) {
    const years = (now.getTime() - created.getTime()) / (365.25 * 864e5);
    if (years >= 3) {
      factors.push({
        id: "ANCIENNETE_ETABLIE",
        label: "Société établie",
        detail: `Société sujet créée il y a ${Math.floor(years)} ans — antériorité établie.`,
      });
    }
  }

  // 6. TVA intracommunautaire active (VIES) — corroboration d'identité (jamais
  // un signal de risque : une TVA inactive est neutre pour une PME domestique).
  const subject = rootCompany(bundle);
  if (subject?.attributes?.["Statut TVA (VIES)"] === "active") {
    const num = subject.attributes["TVA intracommunautaire"];
    factors.push({
      id: "TVA_INTRACOM_ACTIVE",
      label: "TVA intracommunautaire active",
      detail: `Numéro de TVA intracommunautaire validé et actif au registre VIES${
        num ? ` (${num})` : ""
      }.`,
    });
  }

  return factors;
}

import type { CaseEntity } from "@/lib/graph/graph-types";
import type { PappersResult, PappersFinance } from "@/lib/connectors/pappers";

export type PappersNormalized = {
  finances: PappersFinance | null;
  financialAttributes: Record<string, string>;
};

export function normalizePappers(
  raw: unknown,
  subjectCompanyId: string,
  entities: CaseEntity[],
): PappersNormalized {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<PappersResult>;

  // Exercice le plus récent (trié par année décroissante)
  const sorted = [...(data.finances ?? [])].sort((a, b) => b.annee - a.annee);
  const latest: PappersFinance | null = sorted[0] ?? null;

  const financialAttributes: Record<string, string> = {};
  if (latest) {
    if (latest.chiffre_affaires != null) {
      financialAttributes["CA (dernier exercice)"] =
        `${latest.chiffre_affaires.toLocaleString("fr-FR")} € (${latest.annee})`;
    }
    if (latest.resultat_net != null) {
      financialAttributes["Résultat net"] =
        `${latest.resultat_net.toLocaleString("fr-FR")} € (${latest.annee})`;
    }
    if (latest.capitaux_propres != null) {
      financialAttributes["Capitaux propres"] =
        `${latest.capitaux_propres.toLocaleString("fr-FR")} € (${latest.annee})`;
    }
    if (latest.effectif != null) {
      financialAttributes["Effectif déclaré"] =
        `${latest.effectif.toLocaleString("fr-FR")} (${latest.annee})`;
    }
  }

  // Enrichir le nœud sujet canonique avec les attributs financiers
  const subject = entities.find((e) => e.id === subjectCompanyId);
  if (subject && Object.keys(financialAttributes).length > 0) {
    subject.attributes = { ...subject.attributes, ...financialAttributes };
  }

  return { finances: latest, financialAttributes };
}

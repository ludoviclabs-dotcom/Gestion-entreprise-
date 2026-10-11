import type { CaseEdge, CaseEntity } from "@/lib/graph/graph-types";
import type { PersonMatch, SanctionsPersonsRaw } from "@/lib/connectors/sanctions-persons";
import { normalizeName } from "@/lib/match/normalize";
import { slugify } from "@/lib/text";
import { listNature } from "./normalize-sanctions-intl";

/**
 * Normalise le contrôle des PERSONNES contre les listes de sanctions internationales.
 *
 * Doctrine (voir `sanctions-persons-match.ts`) : un nom de personne est une
 * hypothèse. Seule une correspondance dont l'année de naissance concorde entre dans
 * le graphe (nœud « sanction » en niveau « simulé », lien `EST_VISE_PAR`, donc
 * `PROXIMITE_SANCTION`). Les autres ne vivent que dans des attributs : jamais de
 * nœud, de lien ni de signal, et jamais de présentation comme « confirmée ».
 */
export const SANCTIONS_PERSONS_ATTRIBUTE = "Contrôle des dirigeants (sanctions internationales)";
export const PERSON_MATCH_ATTRIBUTE = "Listes de sanctions internationales";
const MAX_ATTRIBUTE = 700;
const MAX_WEAK_PER_PERSON = 3;

export type SanctionsPersonsNormalized = {
  entities: CaseEntity[];
  edges: CaseEdge[];
  /** Attributs à poser sur le nœud de chaque personne concernée (clé = id interrogé). */
  personAttributes: Record<string, Record<string, string>>;
  /** Attribut de synthèse pour la société du dossier. */
  attributes: Record<string, string>;
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "date inconnue");

const aliasNote = (m: PersonMatch): string | null =>
  normalizeName(m.matchedName) === normalizeName(m.nom) ? null : m.matchedName;

export function normalizeSanctionsPersons(
  raw: unknown,
  ctx: { personIds: ReadonlySet<string> },
): SanctionsPersonsNormalized {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<SanctionsPersonsRaw>;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const lists = Array.isArray(data.lists) ? data.lists : [];
  const entities = new Map<string, CaseEntity>();
  const edges: CaseEdge[] = [];
  const weakByPerson = new Map<string, PersonMatch[]>();
  let corroborated = 0;

  for (const m of matches) {
    if (!ctx.personIds.has(m.queryKey)) continue;
    if (m.birth !== "corroborated") {
      const list = weakByPerson.get(m.queryKey) ?? [];
      list.push(m);
      weakByPerson.set(m.queryKey, list);
      continue;
    }
    corroborated++;
    const sanctionId = `sa:intl:p:${m.list}:${slugify(m.entryKey)}`;
    const listName = m.sublist ? `${m.listLabel} — ${m.sublist}` : m.listLabel;
    const alias = aliasNote(m);
    if (!entities.has(sanctionId)) {
      entities.set(sanctionId, {
        id: sanctionId,
        type: "sanction",
        label: `Correspondance « ${m.nom} »`,
        // Toujours « simulé » : un nom + une année de naissance ne prouvent pas une identité.
        evidenceLevel: "simulated",
        attributes: {
          Liste: listName,
          Nature: listNature(m.sublist),
          ...(m.programs.length > 0 ? { Programmes: m.programs.slice(0, 3).join(" ; ") } : {}),
          ...(m.countries.length > 0 ? { Pays: m.countries.slice(0, 3).join(" ; ") } : {}),
          ...(m.listedOn ? { "Inscrit le": m.listedOn } : {}),
          ...(alias ? { "Nom rapproché": `${alias} (alias ou autre dénomination de la même entrée)` } : {}),
          Type: m.name === "exact" ? "Nom identique, naissance concordante" : "Nom inclus, naissance concordante",
          "Année de naissance concordante": m.birthYears.slice(0, 3).join(" ; "),
        },
        source: `Listes de sanctions internationales — ${m.listLabel}`,
        excerpt:
          "Rapprochement nominatif d'une personne corroboré par l'année de naissance — à vérifier manuellement (homonymie possible), aucune certitude.",
      });
    }
    edges.push({
      id: `e:${m.queryKey}:${sanctionId}`,
      type: "EST_VISE_PAR",
      source: m.queryKey,
      target: sanctionId,
      label: "correspondance possible (nom et année de naissance)",
      evidenceLevel: "simulated",
      excerpt:
        "Listes de sanctions internationales — nom et année de naissance concordants, hypothèse à vérifier.",
    });
  }

  // Attributs des personnes : homonymes possibles (jamais dans le graphe).
  const personAttributes: Record<string, Record<string, string>> = {};
  let weakTotal = 0;
  for (const [key, list] of weakByPerson) {
    weakTotal += list.length;
    const shown = list.slice(0, MAX_WEAK_PER_PERSON).map((m) => {
      const why = m.birth === "near" ? "année de naissance voisine" : "année de naissance non comparable";
      const alias = aliasNote(m);
      return `« ${m.nom} »${alias ? ` (rapproché de « ${alias} »)` : ""} (${m.sublist ?? m.listLabel}, ${why})`;
    });
    personAttributes[key] = {
      [PERSON_MATCH_ATTRIBUTE]: (
        `Nom identique ou inclus dans une liste, sans corroboration : ${shown.join(" ; ")}. ` +
        "Un nom identique ne prouve pas l'identité — à vérifier, sans conclusion."
      ).slice(0, MAX_ATTRIBUTE),
    };
  }

  // Synthèse pour la société : ce qui a été contrôlé, et ce que cela ne dit pas.
  const queried = Number(data.queried ?? 0);
  const parts: string[] = [];
  const ok = lists.filter((l) => l.state === "ok");
  const notOk = lists.filter((l) => l.state !== "ok");
  if (data.status === "non_importe" || data.status === "indisponible" || queried === 0) {
    parts.push(
      data.status === "indisponible"
        ? "Contrôle des personnes indisponible (aucune conclusion possible)."
        : data.status === "non_importe"
          ? "Personnes des listes non importées : aucun contrôle des personnes n'a pu être mené."
          : "Aucune personne à nom complet à contrôler.",
    );
  } else {
    parts.push(
      `${queried} personne(s) contrôlée(s) (dirigeants et bénéficiaires publiés)` +
        `${ok.length > 0 ? ` sur ${ok.length} liste(s) à jour` : ""}.`,
    );
    parts.push(
      corroborated === 0 && weakTotal === 0
        ? "Aucune correspondance de nom."
        : `${corroborated} correspondance(s) corroborée(s) par l'année de naissance (dans le graphe) ; ${weakTotal} homonyme(s) possible(s) à vérifier (hors graphe).`,
    );
    const withoutYear = queried - Number(data.withBirthYear ?? 0);
    if (withoutYear > 0) {
      parts.push(`${withoutYear} personne(s) sans année de naissance publiée : contrôle par le nom seul, donc jamais corroboré.`);
    }
    if (Number(data.excluded ?? 0) > 0) {
      parts.push(`${data.excluded} homonyme(s) écarté(s) car l'année de naissance diffère.`);
    }
    if (Number(data.notQueried ?? 0) > 0) {
      parts.push(`${data.notQueried} personne(s) non contrôlée(s) (limite par dossier ou nom d'un seul mot).`);
    }
    if (notOk.length > 0) {
      parts.push(
        `Listes non consultées pour les personnes ou non à jour : ${notOk.map((l) => l.label).join(" ; ")}.`,
      );
    }
    if (ok.length > 0) {
      const dates = ok.map((l) => day(l.checkedAt)).sort();
      parts.push(`Dernière vérification des listes le ${dates[dates.length - 1]}.`);
    }
    if (data.truncated) parts.push("Pré-sélection tronquée pour au moins une personne.");
  }

  return {
    entities: [...entities.values()],
    edges,
    personAttributes,
    attributes: { [SANCTIONS_PERSONS_ATTRIBUTE]: parts.join(" ").slice(0, MAX_ATTRIBUTE) },
  };
}

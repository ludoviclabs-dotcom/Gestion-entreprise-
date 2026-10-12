import {
  FOREIGN_REGISTRY_LABELS,
  type ForeignRegistryEntity,
  type ForeignRegistryKey,
  type ForeignRegistryRaw,
} from "@/lib/connectors/foreign-registries";

/**
 * Attributs d'une société mère étrangère issus du registre officiel de son pays,
 * interrogé par identifiant (second saut GLEIF). Information seulement : aucun
 * nœud, lien ni signal — un statut étranger n'entre pas dans le moteur de risque.
 *
 * Neutre et sourcé : le libellé nomme le registre et reprend ce que celui-ci publie.
 */
const frDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function describe(registry: ForeignRegistryKey, e: ForeignRegistryEntity): string {
  const parts: string[] = [];
  parts.push(e.name);
  if (e.form) parts.push(`forme : ${e.form}`);
  if (e.status) parts.push(`statut publié : ${e.status}`);
  if (e.deletedOn) parts.push(`radiée le ${frDate(e.deletedOn)}`);
  if (registry === "no") {
    if (e.bankrupt === true) parts.push("faillite déclarée au registre");
    if (e.inLiquidation === true) parts.push("dissolution ou liquidation en cours au registre");
    if (e.lastAccountsYear) parts.push(`derniers comptes annuels déposés : exercice ${e.lastAccountsYear}`);
    if (e.employees !== null) parts.push(`${e.employees.toLocaleString("fr-FR")} salarié(s) déclaré(s)`);
    if (e.industry) parts.push(`activité : ${e.industry}`);
  }
  if (e.registeredOn) parts.push(`immatriculée le ${frDate(e.registeredOn)}`);
  parts.push(`n° ${e.number}`);
  return `${parts.join(" — ")}. Interrogé par identifiant (rapprochement exact via GLEIF), sans interprétation.`;
}

/** Attribut de la société mère ; vide si le registre n'a rien répondu d'exploitable. Ne lève jamais. */
export function foreignRegistryAttributes(raw: unknown): Record<string, string> {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<ForeignRegistryRaw>;
  if (data.status !== "ok" || !data.entity || !data.registry) return {};
  const label = FOREIGN_REGISTRY_LABELS[data.registry];
  if (!label) return {};
  return { [label]: describe(data.registry, data.entity).slice(0, 700) };
}

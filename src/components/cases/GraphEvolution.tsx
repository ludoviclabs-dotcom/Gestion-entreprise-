import { EDGE_LABELS } from "@/lib/graph/graph-types";
import type { BundleDiff, EdgeFieldChange } from "@/lib/graph/diff";

const FIELD_LABELS: Record<EdgeFieldChange["field"], string> = {
  weight: "pourcentage",
  validFrom: "début de validité",
  validTo: "fin de validité",
  evidenceLevel: "niveau de preuve",
};

/**
 * Affiche le diff d'évolution d'un dossier (T0 → T1) : nœuds/liens apparus ou
 * disparus, et liens modifiés (ex. cession de parts). Fait basculer l'outil de
 * « photo » à « surveillance ». Composant serveur.
 */
export default function GraphEvolution({
  diff,
  fromLabel,
  labels,
}: {
  diff: BundleDiff;
  fromLabel: string;
  labels: Record<string, string>;
}) {
  const lab = (id: string) => labels[id] ?? id;
  const row = "flex items-start gap-2 text-sm";

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">
        Évolution du graphe
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Différentiel depuis « {fromLabel} ». Ce qui a changé : nouveaux liens,
        cessions, modifications de détention.
      </p>

      {!diff.hasChanges ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Aucun changement structurel depuis l&apos;état précédent.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {diff.addedNodes.map((n) => (
            <li key={`an-${n.id}`} className={row}>
              <span className="font-semibold text-emerald">＋</span>
              <span>
                Nouvelle entité : <span className="font-medium">{n.label}</span>
              </span>
            </li>
          ))}
          {diff.addedEdges.map((e) => (
            <li key={`ae-${e.id}`} className={row}>
              <span className="font-semibold text-emerald">＋</span>
              <span>
                Nouveau lien {EDGE_LABELS[e.type]} : {lab(e.source)} →{" "}
                {lab(e.target)}
                {e.weight ? ` (${e.weight})` : ""}
              </span>
            </li>
          ))}
          {diff.changedEdges.map(({ edge, changes }) => (
            <li key={`ce-${edge.id}`} className={row}>
              <span className="font-semibold text-[#E69F00]">≠</span>
              <span>
                {lab(edge.source)} → {lab(edge.target)} :{" "}
                {changes
                  .map(
                    (c) =>
                      `${FIELD_LABELS[c.field]} ${c.before ?? "∅"} → ${c.after ?? "∅"}`,
                  )
                  .join(", ")}
              </span>
            </li>
          ))}
          {diff.removedEdges.map((e) => (
            <li key={`re-${e.id}`} className={row}>
              <span className="font-semibold text-[#D55E00]">－</span>
              <span>
                Lien supprimé {EDGE_LABELS[e.type]} : {lab(e.source)} →{" "}
                {lab(e.target)}
              </span>
            </li>
          ))}
          {diff.removedNodes.map((n) => (
            <li key={`rn-${n.id}`} className={row}>
              <span className="font-semibold text-[#D55E00]">－</span>
              <span>
                Entité retirée : <span className="font-medium">{n.label}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

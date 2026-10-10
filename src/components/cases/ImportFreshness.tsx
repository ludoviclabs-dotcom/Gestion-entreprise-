import type { ImportFreshness as Freshness } from "@/lib/data/import-freshness";
import { Card } from "@/components/ui/card";

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));

export default function ImportFreshness({ imports }: { imports: Freshness[] }) {
  return (
    <Card className="mt-4 gap-0 p-5">
      <h2 className="font-medium">Jeux de données importés</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        La date indique le dernier import complet, pas la date de mise à jour de chaque information à la source.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {imports.map((item) => (
          <li key={item.source} className="py-3">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {item.state === "ok" && item.importedAt
                ? <>Importé le {date(item.importedAt)} · {item.recordCount.toLocaleString("fr-FR")} lignes.
                    {item.checkedAt ? <> Dernière vérification le {date(item.checkedAt)}.</> : null}</>
                : item.state === "missing" ? "Source non importée : aucune absence ne peut être conclue."
                : item.state === "unconfigured" ? "Base de données non configurée."
                : "État des imports indisponible : vérifier la connexion et le schéma de la base."}
            </p>
            {item.lastAttemptFailed ? (
              <p className="mt-1 text-xs text-amber-600">La dernière tentative a échoué.
                {item.state === "ok" ? " Le dernier import réussi reste disponible." : " Aucun jeu validé n’est disponible."}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

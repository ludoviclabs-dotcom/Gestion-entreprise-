import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isDemoMode } from "@/lib/env";
import { getConnectorStatuses } from "@/lib/connectors/status";

export const metadata = { title: "Réglages — KYB Graph" };

const EMERALD = "#10b981";
const AMBER = "#f59e0b";

export default function ReglagesPage() {
  const demo = isDemoMode();
  const statuses = getConnectorStatuses();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Réglages
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configuration de l&apos;environnement et statut des sources de données.
      </p>

      <Card className="mt-6 gap-0 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Mode d&apos;exécution</p>
            <p className="text-sm text-muted-foreground">
              {demo
                ? "Les connecteurs renvoient des données de démonstration (fixtures)."
                : "Les connecteurs interrogent les API officielles en temps réel."}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-border"
            style={{ color: demo ? AMBER : EMERALD }}
          >
            {demo ? "Démonstration" : "Live"}
          </Badge>
        </div>
      </Card>

      <Card className="mt-4 gap-0 p-5">
        <p className="font-medium">Sources de données</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Statut réel de chaque connecteur, dérivé des variables
          d&apos;environnement actives sur cet environnement.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {statuses.map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
              <Badge
                variant="outline"
                className="shrink-0 border-border"
                style={{ color: s.live ? EMERALD : AMBER }}
              >
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.live ? EMERALD : AMBER }}
                />
                {s.live ? "Live" : "Démo"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

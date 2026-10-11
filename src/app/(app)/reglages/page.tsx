import { connection } from "next/server";
import ImportFreshness from "@/components/cases/ImportFreshness";
import { getImportFreshness } from "@/lib/data/import-freshness";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isDemoMode } from "@/lib/env";
import { getConnectorStatuses } from "@/lib/connectors/status";
import {
  CONNECTOR_SOURCE,
  HEALTH_WINDOW_DAYS,
  NO_DATA,
  getConnectorHealth,
  type ObservedHealth,
} from "@/lib/data/connector-health";

export const metadata = { title: "Réglages — KYB Graph" };

const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";

const OBSERVED_LABEL: Record<ObservedHealth["state"], string> = {
  operational: "Opérationnel",
  degraded: "Dégradé",
  failing: "En échec",
  no_data: "Non consulté",
};
const OBSERVED_COLOR: Record<ObservedHealth["state"], string> = {
  operational: EMERALD,
  degraded: AMBER,
  failing: RED,
  no_data: "var(--muted-foreground)",
};

const day = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

/** Phrase de preuve : ce qui a été réellement observé, jamais la seule configuration. */
function observedDetail(h: ObservedHealth): string {
  const window = `sur ${HEALTH_WINDOW_DAYS} jours`;
  switch (h.state) {
    case "operational":
      return `${h.ok}/${h.consulted} consultations réussies ${window}${h.lastAt ? ` · dernière le ${day(h.lastAt)}` : ""}.`;
    case "degraded":
      return `${h.ok}/${h.consulted} consultations réussies ${window} · dernier incident : ${h.lastIssue ?? "inconnu"}.`;
    case "failing":
      return `${
        h.failingReason === "rate"
          ? "Cette source échoue presque systématiquement"
          : "Les dernières consultations ont échoué"
      } (${h.lastIssue ?? "inconnu"}) · ${h.ok}/${h.consulted} réussies ${window}. Les résultats « aucune correspondance » de cette source ne sont pas fiables.`;
    default:
      return `Aucune consultation réelle ces ${HEALTH_WINDOW_DAYS} derniers jours.`;
  }
}

export default async function ReglagesPage() {
  await connection();
  const imports = await getImportFreshness();
  const demo = isDemoMode();
  const statuses = getConnectorStatuses();
  // Fonctionnement observé (consultations réelles) ; `null` = base indisponible.
  const health = demo ? null : await getConnectorHealth();

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
                : "Les connecteurs configurés interrogent les API officielles. Configuré ne veut pas dire opérationnel : l'état observé de chaque source est donné ci-dessous."}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-border"
            style={{ color: demo ? AMBER : EMERALD }}
          >
            {demo ? "Démonstration" : "Mode réel"}
          </Badge>
        </div>
      </Card>

      <Card className="mt-4 gap-0 p-5">
        <p className="font-medium">Sources de données</p>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Configuration</strong> :
          variables d&apos;environnement actives sur cet environnement.{" "}
          <strong className="font-medium text-foreground">Fonctionnement observé</strong> :
          issue des consultations réelles des {HEALTH_WINDOW_DAYS} derniers
          jours (une clé refusée ou des crédits épuisés apparaissent « En échec »).
        </p>
        <ul className="mt-4 divide-y divide-border">
          {statuses.map((s) => {
            const source = CONNECTOR_SOURCE[s.key] ?? null;
            // Observé seulement pour une source réellement configurée et enregistrée.
            const observed =
              s.live && source ? (health ? (health.get(source) ?? NO_DATA) : undefined) : undefined;
            const observationUnavailable = s.live && source !== null && health === null;
            return (
              <li
                key={s.key}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                  {observed ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {observedDetail(observed)}
                    </p>
                  ) : observationUnavailable ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fonctionnement observé indisponible (historique des consultations non lisible).
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-border"
                    style={{ color: s.live ? EMERALD : AMBER }}
                  >
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: s.live ? EMERALD : AMBER }}
                    />
                    {s.live ? "Configurée" : "Démo"}
                  </Badge>
                  {observed ? (
                    <Badge
                      variant="outline"
                      className="border-border"
                      style={{ color: OBSERVED_COLOR[observed.state] }}
                    >
                      <span
                        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: OBSERVED_COLOR[observed.state] }}
                      />
                      {OBSERVED_LABEL[observed.state]}
                    </Badge>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <ImportFreshness imports={imports} />
    </div>
  );
}

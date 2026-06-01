import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Réglages — KYB Graph" };

export default function ReglagesPage() {
  const demo = isDemoMode();
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
        Réglages
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configuration de l&apos;environnement et des sources de données.
      </p>

      <Card className="mt-6 gap-0 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Mode démonstration</p>
            <p className="text-sm text-muted-foreground">
              Les connecteurs renvoient des données fictives, sans aucune clé API.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-border"
            style={{ color: demo ? "#10b981" : "#8aa0bd" }}
          >
            {demo ? "Activé" : "Désactivé"}
          </Badge>
        </div>
      </Card>

      <Card className="mt-4 gap-0 p-5">
        <p className="font-medium">Sources de données</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Le raccordement aux sources réelles (INSEE Sirene, BODACC, INPI/RNE,
          DG Trésor) et à la base de données est prévu dans une phase ultérieure.
          Cette interface fonctionne entièrement sur des données de démonstration.
        </p>
      </Card>
    </div>
  );
}

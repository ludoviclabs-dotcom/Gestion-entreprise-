import type { Metadata } from "next";
import { ScenarioPlayer } from "@/components/learning/scenario/ScenarioPlayer.client";
import { CRYPTO_FLUX } from "@/lib/learning/paths";
import { NOVA_SCENARIO } from "@/lib/learning/scenarios/nova";

export const metadata: Metadata = {
  title: "Le paiement de Nova, scénario — Lab KYB Graph",
  description:
    "Scénario fictif et jouable : suivre un paiement de la banque à la chaîne, repérer les frontières de connaissance et comparer ce que voit chaque observateur.",
};

export default function NovaScenarioPage() {
  return (
    <ScenarioPlayer
      scenario={NOVA_SCENARIO}
      path={CRYPTO_FLUX}
      views={[
        { id: "graphe", title: "Graphe à couches", question: "Qui intervient, et quelle relation est documentée ?" },
        { id: "flux" },
        { id: "chronologie", title: "Chronologie", question: "Dans quel ordre arrivent opérations et documents ?" },
        { id: "perspectives" },
      ]}
    />
  );
}

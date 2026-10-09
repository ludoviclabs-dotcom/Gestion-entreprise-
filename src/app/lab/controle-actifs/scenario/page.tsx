import type { Metadata } from "next";
import { ScenarioPlayer } from "@/components/learning/scenario/ScenarioPlayer.client";
import { CONTROLE_ACTIFS } from "@/lib/learning/paths";
import { ASTER_SCENARIO } from "@/lib/learning/scenarios/aster";

export const metadata: Metadata = {
  title: "Aster Photonique, scénario — Lab KYB Graph",
  description:
    "Scénario fictif et jouable : suivre le capital, le contrôle, les dépendances et les accès d'une entreprise industrielle de T0 à T4, puis conclure selon les pièces.",
};

export default function AsterScenarioPage() {
  return <ScenarioPlayer scenario={ASTER_SCENARIO} path={CONTROLE_ACTIFS} />;
}

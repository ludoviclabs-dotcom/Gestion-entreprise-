import type { Metadata } from "next";
import DemoSimulation from "@/components/demo/DemoSimulation.client";

export const metadata: Metadata = {
  title: "Démo guidée — KYB Graph",
  description:
    "Simulation automatique d'une vérification KYB : recherche SIREN, graphe relationnel, alertes réglementaires (LCB-FT / AMLR 2024/1624) et scores de vigilance.",
};

/** Démo auto-jouée, plein écran (hors shell applicatif) — cf. brief v3. */
export default function DemoPage() {
  return <DemoSimulation />;
}

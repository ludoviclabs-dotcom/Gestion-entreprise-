import type { Metadata } from "next";
import FraudDetectiveGame from "@/components/lab/FraudDetectiveGame.client";

export const metadata: Metadata = {
  title: "Fraud Detective — KYB Graph",
  description:
    "Jeu pédagogique KYB : inspecter un graphe de conformité, signaler des motifs de fraude et exporter un rapport d'investigation.",
};

export default function FraudDetectivePage() {
  return <FraudDetectiveGame />;
}

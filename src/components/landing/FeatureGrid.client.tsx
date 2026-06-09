"use client";

import { LockKeyhole, Network, Scale, ShieldCheck } from "lucide-react";
import FeatureCard from "./FeatureCard.client";

/**
 * Bande de features de la landing. Les icônes lucide (composants) sont
 * référencées ici, côté client, puis passées à FeatureCard — un composant
 * (fonction) ne peut pas franchir la frontière server → client.
 */
const TRUST_POINTS = [
  {
    title: "Traçabilité complète",
    text: "Chaîne de preuve horodatée",
    icon: ShieldCheck,
  },
  {
    title: "Cadre réglementaire",
    text: "Aligné LCB-FT, RGPD et normes internes",
    icon: Scale,
  },
  {
    title: "Analyse approfondie",
    text: "Graphes relationnels et signaux contextuels",
    icon: Network,
  },
  {
    title: "Contrôle et confidentialité",
    text: "Données sécurisées, accès maîtrisés",
    icon: LockKeyhole,
  },
];

export default function FeatureGrid() {
  return (
    <div className="mx-auto grid max-w-[1800px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TRUST_POINTS.map((point, index) => (
        <FeatureCard
          key={point.title}
          icon={point.icon}
          title={point.title}
          body={point.text}
          index={index}
        />
      ))}
    </div>
  );
}

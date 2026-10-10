import type { Metadata } from "next";
import DesignSystemPreview from "@/components/design-system/DesignSystemPreview.client";

/**
 * Prévisualisation interne du design system : tokens lus en direct, primitives,
 * états et motion. Page non liée, non indexée ; aucune donnée métier.
 * Contrat : DESIGN_SYSTEM.md · src/styles/design-tokens.css.
 */
export const metadata: Metadata = {
  title: "Design system — KYB Graph",
  description:
    "Prévisualisation interne des tokens, primitives, états et règles de motion de KYB Graph.",
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  return <DesignSystemPreview />;
}

import type { Threat } from "./content";

const LABEL: Record<Threat, string> = { m: "Modéré", e: "Élevé", c: "Critique" };

/**
 * Pastille de niveau de menace : cerclée (modéré), pleine (élevé), cerclée +
 * anneau (critique). `decorative` pour la légende, dont le libellé suit.
 */
export default function ThreatDot({ t, decorative }: { t: Threat; decorative?: boolean }) {
  return decorative ? (
    <span className={`kgl-threat kgl-threat-${t}`} aria-hidden />
  ) : (
    <span role="img" className={`kgl-threat kgl-threat-${t}`} aria-label={LABEL[t]} />
  );
}

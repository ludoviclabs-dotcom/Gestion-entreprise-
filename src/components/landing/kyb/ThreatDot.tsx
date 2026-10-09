import type { Threat } from "./content";

const LABEL: Record<Threat, string> = { m: "Modéré", e: "Élevé", c: "Critique" };

/** Pastille de niveau de menace : cerclée (modéré), pleine (élevé), cerclée + anneau (critique). */
export default function ThreatDot({ t }: { t: Threat }) {
  return <span role="img" className={`kgl-threat kgl-threat-${t}`} aria-label={LABEL[t]} />;
}

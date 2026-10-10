/**
 * Motion du design system — miroir TypeScript des tokens `--motion-*` de
 * `src/styles/design-tokens.css` (la parité est testée : design-tokens.spec.ts).
 *
 * Règles (cf. DESIGN_SYSTEM.md § Motion) :
 *   - fonctionnelle et courte : 120–220 ms pour tout état d'interface ;
 *   - entrée d'un panneau : translation légère + opacité + ressort doux ;
 *   - sortie plus courte que l'entrée, sans ressort ;
 *   - survol : bordure / halo / fond, jamais de déplacement ni d'échelle ;
 *   - aucune animation répétitive décorative sur un contenu opérationnel ;
 *   - `prefers-reduced-motion` : les états changent sans transition (règle
 *     globale dans globals.css ; côté JS, passer par `useReducedMotion`).
 *
 * Utilisable avec `motion/react` (durées en SECONDES) ou en CSS (durées en ms).
 */

export const MOTION_MS = {
  fast: 120,
  base: 180,
  slow: 220,
  exit: 140,
} as const;

const toSeconds = (ms: number) => ms / 1000;

type Bezier = [number, number, number, number];

export const MOTION = {
  /** Durées en secondes (API de `motion/react`). */
  duration: {
    fast: toSeconds(MOTION_MS.fast),
    base: toSeconds(MOTION_MS.base),
    slow: toSeconds(MOTION_MS.slow),
    exit: toSeconds(MOTION_MS.exit),
  },
  /** Courbes cubic-bezier (mêmes valeurs que `--motion-ease-*`). */
  ease: {
    standard: [0.2, 0, 0, 1] as Bezier,
    out: [0.22, 1, 0.36, 1] as Bezier,
    in: [0.4, 0, 1, 1] as Bezier,
  },
  /** Distances de translation d'entrée, en px. */
  distance: {
    panel: 12,
    fade: 4,
  },
  /** Décalage entre deux groupes d'une apparition progressive (`--motion-stagger`), en s. */
  stagger: toSeconds(50),
  /** Ressort doux pour l'entrée d'un panneau (≈ 2 % de dépassement). */
  spring: {
    type: "spring",
    stiffness: 420,
    damping: 38,
    mass: 0.85,
  },
} as const;

/** Bornes de la règle « durée fonctionnelle » (ms). */
export const MOTION_RANGE_MS = { min: 120, max: 220 } as const;

/**
 * Apparition progressive par groupes : au-delà de ce nombre de groupes, les
 * suivants apparaissent avec le dernier (l'ensemble reste sous ~400 ms).
 */
export const REVEAL_MAX_GROUPS = 5;

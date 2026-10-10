/**
 * Teintes sémantiques du design system — source unique du vocabulaire
 * « succès / vigilance / critique / information / neutre ».
 *
 * Les VALEURS vivent dans `src/styles/design-tokens.css` (`--tone-*`). Ce module
 * ne contient que des noms de classes Tailwind complets (détectés par le scanner)
 * et les types : aucun littéral de couleur.
 *
 * `accent` n'est PAS un niveau de risque : c'est la couleur d'interaction
 * (action, sélection, signal actif, connexion confirmée). Ne jamais l'utiliser
 * pour dire « ok » ou « dangereux ».
 */

/** Les cinq teintes de RISQUE — strictes et constantes dans toute l'application. */
export const RISK_TONES = ["success", "vigilance", "critical", "info", "neutral"] as const;
export type RiskTone = (typeof RISK_TONES)[number];

/** Risque + `accent` (interaction). */
export const TONES = [...RISK_TONES, "accent"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  success: "Succès / prêt",
  vigilance: "Vigilance",
  critical: "Critique",
  info: "Information",
  neutral: "Neutre",
  accent: "Accent (interaction)",
};

/**
 * Référence CSS d'une teinte, pour les styles inline / attributs SVG qui ne
 * peuvent pas porter une classe Tailwind (`style={{ color }}`, `stroke`, `fill`).
 * Toujours la variable — jamais la valeur — pour suivre le thème.
 */
export const TONE_CSS_VAR: Record<Tone, string> = {
  success: "var(--tone-success)",
  vigilance: "var(--tone-vigilance)",
  critical: "var(--tone-critical)",
  info: "var(--tone-info)",
  neutral: "var(--tone-neutral)",
  accent: "var(--primary)",
};

export interface ToneStyle {
  /** Texte coloré — AA sur toutes les surfaces (testé). */
  text: string;
  /** Pastille / point plein. */
  dot: string;
  /** Pastille « soft » : fond teinté 12 %, bordure 30 %, texte. */
  soft: string;
  /** Contour seul, fond transparent. */
  outline: string;
  /** Aplat plein + texte `on-tone` (AA testé). */
  solid: string;
  /** Liseré d'accentuation (callout, ligne signalée). */
  edge: string;
}

export const TONE_STYLES: Record<Tone, ToneStyle> = {
  success: {
    text: "text-tone-success",
    dot: "bg-tone-success",
    soft: "border-tone-success/30 bg-tone-success/12 text-tone-success",
    outline: "border-tone-success/50 bg-transparent text-tone-success",
    solid: "border-transparent bg-tone-success text-on-tone",
    edge: "border-l-tone-success",
  },
  vigilance: {
    text: "text-tone-vigilance",
    dot: "bg-tone-vigilance",
    soft: "border-tone-vigilance/30 bg-tone-vigilance/12 text-tone-vigilance",
    outline: "border-tone-vigilance/50 bg-transparent text-tone-vigilance",
    solid: "border-transparent bg-tone-vigilance text-on-tone",
    edge: "border-l-tone-vigilance",
  },
  critical: {
    text: "text-tone-critical",
    dot: "bg-tone-critical",
    soft: "border-tone-critical/30 bg-tone-critical/12 text-tone-critical",
    outline: "border-tone-critical/50 bg-transparent text-tone-critical",
    solid: "border-transparent bg-tone-critical text-on-tone",
    edge: "border-l-tone-critical",
  },
  info: {
    text: "text-tone-info",
    dot: "bg-tone-info",
    soft: "border-tone-info/30 bg-tone-info/12 text-tone-info",
    outline: "border-tone-info/50 bg-transparent text-tone-info",
    solid: "border-transparent bg-tone-info text-on-tone",
    edge: "border-l-tone-info",
  },
  neutral: {
    text: "text-tone-neutral",
    dot: "bg-tone-neutral",
    soft: "border-tone-neutral/30 bg-tone-neutral/12 text-tone-neutral",
    outline: "border-tone-neutral/50 bg-transparent text-tone-neutral",
    solid: "border-transparent bg-tone-neutral text-on-tone",
    edge: "border-l-tone-neutral",
  },
  accent: {
    text: "text-primary",
    dot: "bg-primary",
    soft: "border-primary/30 bg-primary/12 text-primary",
    outline: "border-primary/50 bg-transparent text-primary",
    solid: "border-transparent bg-primary text-primary-foreground",
    edge: "border-l-primary",
  },
};

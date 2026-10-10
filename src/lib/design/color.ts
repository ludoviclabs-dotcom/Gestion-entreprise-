/**
 * Utilitaires couleur du design system : lecture des tokens OKLCH, conversion
 * sRGB, composition alpha et contraste WCAG 2.x.
 *
 * Servent (1) aux tests de contrat (`design-tokens.spec.ts`) et (2) à la page de
 * prévisualisation (`/design-system`) pour afficher hex et ratios réels. Aucun
 * code applicatif n'en dépend.
 */

export type Rgb = readonly [number, number, number];

export interface ParsedColor {
  rgb: Rgb;
  /** 0–1 */
  alpha: number;
  /** false si la couleur OKLCH sort du gamut sRGB (valeurs écrêtées). */
  inGamut: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function toGamma(x: number): number {
  const v = clamp01(x);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** OKLCH → sRGB 8 bits. `h` en degrés. */
export function oklchToRgb(l: number, c: number, h: number): { rgb: Rgb; inGamut: boolean } {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const inGamut = [r, g, bl].every((x) => x >= -0.0005 && x <= 1.0005);
  return {
    rgb: [Math.round(toGamma(r) * 255), Math.round(toGamma(g) * 255), Math.round(toGamma(bl) * 255)],
    inGamut,
  };
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i;
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Lit `oklch(L C H [/ A])` ou `#rgb` / `#rgba` / `#rrggbb` / `#rrggbbaa`. Retourne null sinon. */
export function parseColor(input: string): ParsedColor | null {
  const s = input.trim();
  const ok = OKLCH_RE.exec(s);
  if (ok) {
    const alphaRaw = ok[4];
    const alpha = alphaRaw === undefined ? 1 : alphaRaw.endsWith("%") ? parseFloat(alphaRaw) / 100 : parseFloat(alphaRaw);
    const { rgb, inGamut } = oklchToRgb(parseFloat(ok[1]), parseFloat(ok[2]), parseFloat(ok[3]));
    return { rgb, alpha, inGamut };
  }
  const hx = HEX_RE.exec(s);
  if (hx) {
    const digits = hx[1].length <= 4 ? hx[1].split("").map((c) => c + c).join("") : hx[1];
    const byte = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return {
      rgb: [byte(0), byte(1), byte(2)],
      alpha: digits.length === 8 ? byte(3) / 255 : 1,
      inGamut: true,
    };
  }
  return null;
}

/** Compose une couleur (avec alpha) sur un fond opaque. */
export function compositeOver(fg: ParsedColor, bg: Rgb): Rgb {
  const a = fg.alpha;
  return [
    Math.round(fg.rgb[0] * a + bg[0] * (1 - a)),
    Math.round(fg.rgb[1] * a + bg[1] * (1 - a)),
    Math.round(fg.rgb[2] * a + bg[2] * (1 - a)),
  ];
}

export function relativeLuminance(rgb: Rgb): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

/** Ratio de contraste WCAG 2.x (1–21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function toHex(rgb: Rgb): string {
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Distance perceptuelle OKLab entre deux couleurs OKLCH (≥ 0,08 : clairement distinctes). */
export function oklabDistance(
  a: { l: number; c: number; h: number },
  b: { l: number; c: number; h: number },
): number {
  const lab = (x: { l: number; c: number; h: number }) => {
    const r = (x.h * Math.PI) / 180;
    return [x.l, x.c * Math.cos(r), x.c * Math.sin(r)] as const;
  };
  const A = lab(a);
  const B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

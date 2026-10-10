/**
 * Lecture minimale d'un fichier CSS de tokens pour les tests de contrat.
 * Pas un parseur CSS complet : suffisant pour `src/styles/design-tokens.css`
 * (règles de style, `@supports`, déclarations multi-lignes avec parenthèses).
 */

export interface CssRule {
  selectors: string[];
  decls: Record<string, string>;
  /** At-rule englobante (ex. « @supports (…) »). */
  ctx?: string;
}

function parseDecls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let depth = 0;
  let cur = "";
  const push = (chunk: string) => {
    const idx = chunk.indexOf(":");
    if (idx <= 0) return;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim().replace(/\s+/g, " ");
    if (key) out[key] = value;
  };
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && depth === 0) {
      push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  push(cur);
  return out;
}

export function parseCss(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let pos = 0;

  function parseRules(ctx: string | undefined, nested: boolean): CssRule[] {
    const out: CssRule[] = [];
    while (pos < src.length) {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      if (pos >= src.length) break;
      if (src[pos] === "}") {
        pos++;
        if (nested) return out;
        continue;
      }
      const start = pos;
      while (pos < src.length && src[pos] !== "{" && src[pos] !== ";" && src[pos] !== "}") pos++;
      const prelude = src.slice(start, pos).trim();
      if (src[pos] === ";") {
        pos++;
        continue;
      }
      if (src[pos] === "{") {
        pos++;
        if (prelude.startsWith("@")) {
          out.push(...parseRules(prelude, true));
        } else {
          const bodyStart = pos;
          let depth = 1;
          while (pos < src.length && depth > 0) {
            if (src[pos] === "{") depth++;
            else if (src[pos] === "}") depth--;
            pos++;
          }
          out.push({
            selectors: prelude.split(",").map((s) => s.trim()),
            decls: parseDecls(src.slice(bodyStart, pos - 1)),
            ctx,
          });
        }
      }
    }
    return out;
  }

  return parseRules(undefined, false);
}

export type ThemeName = "dark" | "light";

/**
 * Tokens effectifs d'un thème : toutes les règles `:root` (dont `:root, .dark`)
 * puis, pour le clair, la surcharge `.light` — l'ordre du fichier est respecté
 * comme le fait la cascade (même élément <html>, même spécificité).
 */
export function themeTokens(rules: CssRule[], theme: ThemeName): Record<string, string> {
  const tokens: Record<string, string> = {};
  const overlay = theme === "dark" ? ".dark" : ".light";
  for (const rule of rules) {
    const hitsRoot = rule.selectors.includes(":root");
    const hitsOverlay = rule.selectors.includes(overlay);
    if (hitsRoot || hitsOverlay) Object.assign(tokens, rule.decls);
  }
  return tokens;
}

/** Résout `var(--x)` récursivement. Lève si une référence est introuvable. */
export function resolveToken(name: string, tokens: Record<string, string>, depth = 0): string {
  const raw = tokens[name];
  if (raw === undefined) throw new Error(`Token introuvable : ${name}`);
  if (depth > 10) throw new Error(`Référence circulaire : ${name}`);
  const match = /^var\((--[a-z0-9-]+)\)$/i.exec(raw.trim());
  return match ? resolveToken(match[1], tokens, depth + 1) : raw;
}

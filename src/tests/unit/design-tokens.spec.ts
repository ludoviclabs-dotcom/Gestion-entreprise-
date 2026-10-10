import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  compositeOver,
  contrastRatio,
  oklabDistance,
  parseColor,
  relativeLuminance,
  type ParsedColor,
  type Rgb,
} from "@/lib/design/color";
import { MOTION, MOTION_MS, MOTION_RANGE_MS, REVEAL_MAX_GROUPS } from "@/lib/design/motion";
import { RISK_TONES } from "@/lib/design/tone";
import {
  parseCss,
  resolveToken,
  themeTokens,
  type ThemeName,
} from "../helpers/css-tokens";

/**
 * Contrat du design system : src/styles/design-tokens.css.
 * Ce qui est testé ici est ce que DESIGN_SYSTEM.md promet : complétude des
 * tokens, contrastes WCAG 2.x AA dans les DEUX thèmes, teintes de risque
 * clairement distinctes, profondeur ordonnée, motion fonctionnelle.
 */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const css = read("src/styles/design-tokens.css");
const rules = parseCss(css);
const THEMES: ThemeName[] = ["dark", "light"];

function color(theme: ThemeName, name: string): ParsedColor {
  const tokens = themeTokens(rules, theme);
  const parsed = parseColor(resolveToken(name, tokens));
  if (!parsed) throw new Error(`Couleur illisible pour ${name} (${theme})`);
  return parsed;
}
const rgb = (theme: ThemeName, name: string): Rgb => color(theme, name).rgb;

const SURFACES = ["--canvas-sunken", "--background", "--surface", "--surface-2", "--surface-3", "--sidebar"];
const TEXT = ["--foreground", "--muted-foreground", "--foreground-subtle"];
const TONES = ["--tone-success", "--tone-vigilance", "--tone-critical", "--tone-info", "--tone-neutral"];

describe("design-tokens — complétude", () => {
  const REQUIRED = [
    ...SURFACES,
    "--overlay",
    ...TEXT,
    "--foreground-disabled",
    "--border-subtle",
    "--border",
    "--border-strong",
    "--border-control",
    "--primary",
    "--primary-hover",
    "--primary-foreground",
    ...TONES,
    "--on-tone",
    "--proof-confirmed",
    "--proof-declared",
    "--proof-inferred",
    "--proof-simulated",
    "--elevation-xs",
    "--elevation-sm",
    "--elevation-md",
    "--elevation-lg",
    "--glow-primary",
    "--grid-line",
    "--ring",
    "--card",
    "--popover",
    "--radius",
    "--layout-sidebar-width",
    "--layout-topbar-height",
    "--layout-page-gutter",
    "--layout-page-max",
    "--opacity-disabled",
    "--opacity-tint",
    "--z-base",
    "--z-raised",
    "--z-sticky",
    "--z-floating",
    "--z-overlay",
    "--z-toast",
    "--z-skip-link",
    "--motion-duration-fast",
    "--motion-duration-base",
    "--motion-duration-slow",
    "--motion-duration-exit",
    "--motion-ease-standard",
    "--motion-ease-out",
    "--motion-ease-in",
    "--motion-ease-spring",
  ];

  for (const theme of THEMES) {
    it(`tous les tokens requis existent dans le thème ${theme}`, () => {
      const tokens = themeTokens(rules, theme);
      const missing = REQUIRED.filter((name) => tokens[name] === undefined);
      expect(missing).toEqual([]);
    });
  }

  it("les teintes de risque couvrent exactement succès / vigilance / critique / information / neutre", () => {
    expect([...RISK_TONES].sort()).toEqual(["critical", "info", "neutral", "success", "vigilance"]);
    expect(TONES).toHaveLength(RISK_TONES.length);
  });

  it("toutes les couleurs OKLCH sont dans le gamut sRGB (aucun écrêtage silencieux)", () => {
    for (const theme of THEMES) {
      const tokens = themeTokens(rules, theme);
      for (const name of Object.keys(tokens)) {
        const raw = tokens[name];
        if (!raw.startsWith("oklch(")) continue;
        const parsed = parseColor(raw);
        expect(parsed, `${name} (${theme}) illisible`).not.toBeNull();
        expect(parsed?.inGamut, `${name} (${theme}) hors gamut sRGB`).toBe(true);
      }
    }
  });

  it("aucun littéral hex dans le contrat, hormis les alias historiques documentés du mode clair", () => {
    const hexes = [...css.matchAll(/^[^\n]*#[0-9a-fA-F]{3,8}\b[^\n]*$/gm)].map((m) => m[0].trim());
    const allowed = hexes.filter((line) => /^--(violet|teal|teal-2):/.test(line));
    expect(hexes.filter((line) => !allowed.includes(line) && !line.startsWith("/*") && !line.startsWith("*"))).toEqual([]);
  });
});

describe("design-tokens — profondeur par superposition", () => {
  it("sombre : puits < toile < panneau < surélevé < surcouche (luminance croissante)", () => {
    const order = ["--canvas-sunken", "--background", "--surface", "--surface-2", "--surface-3"];
    const lums = order.map((n) => relativeLuminance(rgb("dark", n)));
    for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeGreaterThan(lums[i - 1]);
  });

  it("sombre : fond profond — luminance relative < 0,02 (noir profond / bleu nuit)", () => {
    expect(relativeLuminance(rgb("dark", "--background"))).toBeLessThan(0.02);
  });

  it("sombre : surfaces teintées, jamais un gris neutre (chroma > 0)", () => {
    for (const name of ["--background", "--surface", "--surface-2", "--surface-3"]) {
      const raw = resolveToken(name, themeTokens(rules, "dark"));
      const chroma = parseFloat(/^oklch\(\s*[\d.]+\s+([\d.]+)/.exec(raw)?.[1] ?? "0");
      expect(chroma, `${name} trop neutre`).toBeGreaterThanOrEqual(0.01);
    }
  });
});

describe("design-tokens — contrastes WCAG AA (texte ≥ 4,5:1)", () => {
  for (const theme of THEMES) {
    it(`${theme} : texte principal, secondaire, tertiaire et accent sur toutes les surfaces`, () => {
      const failures: string[] = [];
      for (const fg of [...TEXT, "--primary"]) {
        for (const bg of SURFACES) {
          const ratio = contrastRatio(rgb(theme, fg), rgb(theme, bg));
          if (ratio < 4.5) failures.push(`${fg} sur ${bg} : ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${theme} : chaque teinte de risque lisible comme texte sur toutes les surfaces`, () => {
      const failures: string[] = [];
      for (const fg of TONES) {
        for (const bg of SURFACES) {
          const ratio = contrastRatio(rgb(theme, fg), rgb(theme, bg));
          if (ratio < 4.5) failures.push(`${fg} sur ${bg} : ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${theme} : pastille « soft » (teinte sur teinte à 12 %) lisible sur les surfaces d'usage`, () => {
      const failures: string[] = [];
      for (const tone of [...TONES, "--primary"]) {
        for (const bg of ["--background", "--surface", "--surface-2", "--surface-3"]) {
          const tinted = compositeOver({ ...color(theme, tone), alpha: 0.12 }, rgb(theme, bg));
          const ratio = contrastRatio(rgb(theme, tone), tinted);
          if (ratio < 4.5) failures.push(`${tone}@12% sur ${bg} : ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${theme} : texte sur aplat (action, teintes pleines) ≥ 4,5:1`, () => {
      const failures: string[] = [];
      for (const solid of ["--primary", "--primary-hover"]) {
        const ratio = contrastRatio(rgb(theme, "--primary-foreground"), rgb(theme, solid));
        if (ratio < 4.5) failures.push(`primary-foreground sur ${solid} : ${ratio.toFixed(2)}`);
      }
      for (const solid of [...TONES.filter((t) => t !== "--tone-neutral")]) {
        const ratio = contrastRatio(rgb(theme, "--on-tone"), rgb(theme, solid));
        if (ratio < 4.5) failures.push(`on-tone sur ${solid} : ${ratio.toFixed(2)}`);
      }
      expect(failures).toEqual([]);
    });
  }
});

describe("design-tokens — éléments non textuels (≥ 3:1, WCAG 1.4.11)", () => {
  for (const theme of THEMES) {
    it(`${theme} : frontière de champ, focus et traits de preuve visibles sur les surfaces d'usage`, () => {
      const failures: string[] = [];
      const surfaces = ["--canvas-sunken", "--background", "--surface", "--surface-2"];
      for (const fg of ["--border-control", "--ring", "--proof-confirmed", "--proof-declared", "--proof-inferred", "--proof-simulated"]) {
        for (const bg of surfaces) {
          const ratio = contrastRatio(rgb(theme, fg), rgb(theme, bg));
          if (ratio < 3) failures.push(`${fg} sur ${bg} : ${ratio.toFixed(2)}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }
});

describe("design-tokens — teintes sémantiques distinctes", () => {
  const oklch = (theme: ThemeName, name: string) => {
    const raw = resolveToken(name, themeTokens(rules, theme));
    const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(raw);
    if (!m) throw new Error(`oklch attendu pour ${name}`);
    return { l: parseFloat(m[1]), c: parseFloat(m[2]), h: parseFloat(m[3]) };
  };

  for (const theme of THEMES) {
    it(`${theme} : accent et teintes de risque ≥ 0,08 de distance perceptuelle (OKLab) deux à deux`, () => {
      const names = ["--primary", ...TONES];
      const tooClose: string[] = [];
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const d = oklabDistance(oklch(theme, names[i]), oklch(theme, names[j]));
          if (d < 0.08) tooClose.push(`${names[i]} ↔ ${names[j]} : ${d.toFixed(3)}`);
        }
      }
      expect(tooClose).toEqual([]);
    });
  }
});

describe("design-tokens — espacement et typographie", () => {
  const tokens = themeTokens(rules, "dark");
  const rem = (value: string) => {
    const m = /^(-?[\d.]+)rem$/.exec(value);
    if (!m) throw new Error(`rem attendu, reçu : ${value}`);
    return parseFloat(m[1]);
  };

  it("espacement : chaque palier = n × l'unité de 4 px (mêmes valeurs que Tailwind)", () => {
    expect(tokens["--space-unit"]).toBe("0.25rem");
    for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) {
      expect(rem(tokens[`--space-${n}`]), `--space-${n}`).toBeCloseTo(n * 0.25, 5);
    }
  });

  it("typographie : tailles strictement croissantes ; interlignes ≥ 1,3 (texte) et ≥ 1,2 (titres)", () => {
    const steps = ["micro", "xs", "sm", "base", "lg", "xl", "2xl", "3xl"];
    const sizes = steps.map((s) => rem(tokens[`--font-size-${s}`]));
    const leads = steps.map((s) => rem(tokens[`--line-height-${s}`]));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    sizes.forEach((size, i) => {
      const min = size <= 1 ? 1.3 : 1.2; // texte courant ≤ 16 px · titres d'affichage
      expect(leads[i], steps[i]).toBeGreaterThanOrEqual(size * min - 0.0001);
    });
  });

  it("typographie : seules les graisses d'usage 400 · 500 · 600 · 700 existent", () => {
    const weights = Object.keys(tokens)
      .filter((k) => k.startsWith("--weight-"))
      .map((k) => parseInt(tokens[k], 10))
      .sort((a, b) => a - b);
    expect(weights).toEqual([400, 500, 600, 700]);
  });

  it("globals.css expose chaque taille et graisse du contrat sous son nom Tailwind", () => {
    const globals = read("src/app/globals.css");
    for (const s of ["micro", "xs", "sm", "base", "lg", "xl", "2xl", "3xl"]) {
      expect(globals).toMatch(new RegExp(`--text-${s}:\\s*var\\(--font-size-${s}\\);`));
      expect(globals).toMatch(new RegExp(`--text-${s}--line-height:\\s*var\\(--line-height-${s}\\);`));
    }
    expect(globals).toMatch(/--spacing:\s*0\.25rem;/);
  });
});

describe("design-tokens — échelles", () => {
  it("z-index : paliers strictement croissants", () => {
    const tokens = themeTokens(rules, "dark");
    const order = ["--z-base", "--z-raised", "--z-sticky", "--z-floating", "--z-overlay", "--z-toast", "--z-skip-link"];
    const values = order.map((n) => parseInt(tokens[n], 10));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });

  it("rayon de base 8 px (contrôles 6 px, surcouches 12 px dérivés par Tailwind)", () => {
    expect(themeTokens(rules, "dark")["--radius"]).toBe("0.5rem");
  });
});

describe("design-tokens — motion fonctionnelle", () => {
  const tokens = themeTokens(rules, "dark");
  const ms = (name: string) => {
    const m = /^(\d+)ms$/.exec(tokens[name]);
    if (!m) throw new Error(`durée attendue pour ${name}`);
    return parseInt(m[1], 10);
  };

  it("toutes les durées d'état d'interface sont dans 120–220 ms", () => {
    for (const name of ["--motion-duration-fast", "--motion-duration-base", "--motion-duration-slow", "--motion-duration-exit"]) {
      expect(ms(name)).toBeGreaterThanOrEqual(MOTION_RANGE_MS.min);
      expect(ms(name)).toBeLessThanOrEqual(MOTION_RANGE_MS.max);
    }
  });

  it("la sortie est plus courte que l'entrée", () => {
    expect(ms("--motion-duration-exit")).toBeLessThan(ms("--motion-duration-slow"));
  });

  it("le miroir TypeScript (lib/design/motion) reflète les tokens CSS", () => {
    expect(MOTION_MS).toEqual({
      fast: ms("--motion-duration-fast"),
      base: ms("--motion-duration-base"),
      slow: ms("--motion-duration-slow"),
      exit: ms("--motion-duration-exit"),
    });
    expect(`${MOTION.distance.panel}px`).toBe(tokens["--motion-distance-panel"]);
    expect(`${MOTION.distance.fade}px`).toBe(tokens["--motion-distance-fade"]);
    expect(`${Math.round(MOTION.stagger * 1000)}ms`).toBe(tokens["--motion-stagger"]);
  });

  it("apparition par groupes : la page entière apparaît en moins de 500 ms", () => {
    const total = REVEAL_MAX_GROUPS * ms("--motion-stagger") + ms("--motion-duration-base");
    expect(total).toBeLessThan(500);
  });

  it("les courbes cubic-bezier TypeScript reflètent les tokens CSS", () => {
    const bezier = (name: string) => {
      const m = /^cubic-bezier\(\s*([\d.\s,-]+)\)$/.exec(tokens[name]);
      if (!m) throw new Error(`cubic-bezier attendu pour ${name}`);
      return m[1].split(",").map((n) => parseFloat(n));
    };
    expect(MOTION.ease.standard).toEqual(bezier("--motion-ease-standard"));
    expect(MOTION.ease.out).toEqual(bezier("--motion-ease-out"));
    expect(MOTION.ease.in).toEqual(bezier("--motion-ease-in"));
  });

  it("le ressort doux est un `linear()` avec repli cubic-bezier déclaré avant", () => {
    const decls = rules
      .filter((r) => r.selectors.includes(":root"))
      .map((r) => r.decls["--motion-ease-spring"])
      .filter(Boolean);
    expect(decls.length).toBeGreaterThanOrEqual(2);
    expect(decls[0]).toMatch(/^cubic-bezier\(/);
    expect(decls[decls.length - 1]).toMatch(/^linear\(/);
  });
});

describe("design-tokens — exposition à Tailwind", () => {
  const globals = read("src/app/globals.css");

  it("globals.css importe le contrat avant tout usage", () => {
    expect(globals).toMatch(/@import\s+"\.\.\/styles\/design-tokens\.css";/);
  });

  it("chaque token structurant est exposé par `@theme inline`", () => {
    const exposed = [
      "background", "sunken", "surface", "surface-2", "surface-3", "overlay",
      "foreground", "subtle", "border", "border-subtle", "border-strong", "control",
      "primary", "primary-hover", "primary-foreground", "ring",
      "tone-success", "tone-vigilance", "tone-critical", "tone-info", "tone-neutral", "on-tone",
      "proof-confirmed", "proof-declared", "proof-inferred", "proof-simulated",
    ];
    const missing = exposed.filter((n) => !new RegExp(`--color-${n}:`).test(globals));
    expect(missing).toEqual([]);
  });

  it("la bordure par défaut est le filet froid (couche de base)", () => {
    expect(globals).toMatch(/border-color:\s*var\(--border\)/);
  });

  it("prefers-reduced-motion neutralise animations et transitions", () => {
    expect(globals).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.01ms !important/);
    expect(globals).toMatch(/transition-duration: 0\.01ms !important/);
  });
});

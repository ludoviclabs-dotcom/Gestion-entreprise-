import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Contrat du design system — territoire de code.
 *
 * Les primitives (ui, shell, empty), la couche TypeScript du design system
 * (lib/design) et la page de prévisualisation n'utilisent QUE des tokens :
 * aucun littéral de couleur, aucune ombre/flou ad hoc, aucun z-index brut,
 * aucune taille de texte arbitraire, aucun alias de couleur historique. Le
 * tableau de bord (refondu sur le design system) y est inclus ; les autres pages
 * métier et le graphe migrent lot par lot (cf. DESIGN_SYSTEM.md § Dette).
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const TERRITORY = [
  "src/components/ui",
  "src/components/shell",
  "src/components/empty",
  "src/components/design-system",
  "src/components/dashboard",
  "src/app/(app)/dashboard",
  "src/components/transactions",
  "src/app/(app)/transactions",
  "src/lib/design",
];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const rel = path.posix.join(dir, name);
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const FILES = TERRITORY.flatMap(walk).filter((f) => /\.(tsx?|css)$/.test(f));

/** Retire commentaires de bloc et de ligne (les règles visent le code, pas la doc). */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function offenders(re: RegExp, allow: (file: string) => boolean = () => false): string[] {
  return FILES.filter((f) => !allow(f)).flatMap((f) => {
    const hits = [...code(f).matchAll(re)].map((m) => m[0]);
    return hits.length ? [`${f} → ${[...new Set(hits)].slice(0, 3).join(", ")}`] : [];
  });
}

describe("design-contract — territoire du design system", () => {
  it("le territoire contient bien les primitives attendues", () => {
    for (const expected of [
      "src/components/shell/AppShell.tsx",
      "src/components/shell/Sidebar.tsx",
      "src/components/shell/TopBar.tsx",
      "src/components/shell/PageHeader.tsx",
      "src/components/ui/card.tsx",
      "src/components/ui/metric-chip.tsx",
      "src/components/ui/status-badge.tsx",
      "src/components/ui/icon-button.tsx",
      "src/components/ui/tabs.tsx",
      "src/components/ui/segmented-control.tsx",
      "src/components/ui/data-table.tsx",
      "src/components/ui/tooltip.tsx",
      "src/components/ui/dialog.tsx",
      "src/components/ui/side-panel.tsx",
      "src/components/empty/EmptyState.tsx",
      "src/components/empty/LoadingState.tsx",
      "src/components/empty/ErrorState.tsx",
      "src/components/ui/stat-card.tsx",
      "src/components/ui/reveal.tsx",
      "src/components/ui/native-select.tsx",
      "src/components/shell/nav.ts",
      "src/components/shell/SessionStatus.tsx",
    ]) {
      expect(FILES, expected).toContain(expected);
    }
  });

  it("aucun littéral de couleur (hex, rgb, hsl, oklch) dans le territoire", () => {
    // `color.ts` contient les expressions régulières de lecture, pas des couleurs.
    const allow = (f: string) => f === "src/lib/design/color.ts";
    expect(offenders(/#[0-9a-fA-F]{3,8}\b/g, allow)).toEqual([]);
    expect(offenders(/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g, allow)).toEqual([]);
  });

  it("aucune couleur de la palette Tailwind brute (bg-red-500, text-slate-400, white, black…)", () => {
    const palette =
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|decoration|accent|caret)-(?:(?:white|black)(?:\/\d+)?|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/g;
    expect(offenders(palette)).toEqual([]);
  });

  it("aucun alias de couleur historique (violet, teal, emerald, amber, red) dans le territoire", () => {
    const legacy = /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:violet|teal|teal-2|emerald|amber|red)(?:\/\d+)?\b|var\(--(?:violet|teal|teal-2|emerald|amber|red)\)/g;
    expect(offenders(legacy)).toEqual([]);
  });

  it("aucun z-index brut : uniquement les paliers --z-*", () => {
    expect(offenders(/(?<![\w-])-?z-(?:\d+|auto)\b/g)).toEqual([]);
    expect(offenders(/z-\[(?!var\(--z-)[^\]]+\]/g)).toEqual([]);
  });

  it("aucune taille de texte arbitraire en px : échelle Tailwind + `text-micro`", () => {
    expect(offenders(/\btext-\[\d+(?:\.\d+)?px\]/g)).toEqual([]);
  });

  it("aucun flou d'arrière-plan sur les contenus (seules la Topbar et l'en-tête de la prévisualisation)", () => {
    const allow = (f: string) =>
      f === "src/components/shell/TopBar.tsx" ||
      f === "src/components/design-system/DesignSystemPreview.client.tsx";
    expect(offenders(/\bbackdrop-blur(?:-[a-z0-9]+)?\b|backdrop-filter/g, allow)).toEqual([]);
  });

  it("aucun dégradé décoratif de surface (linear/radial-gradient) dans les primitives", () => {
    expect(offenders(/\b(?:linear|radial|conic)-gradient\(|\bbg-gradient-to-/g)).toEqual([]);
  });

  it("aucune animation qui boucle sur du contenu opérationnel (hors chargement)", () => {
    // Autorisés : indicateurs de CHARGEMENT uniquement — spinner de LoadingState,
    // pulse du squelette, icône de chargement d'un toast (sonner).
    const allow = (f: string) =>
      f === "src/components/empty/LoadingState.tsx" ||
      f === "src/components/ui/skeleton.tsx" ||
      f === "src/components/ui/sonner.tsx";
    expect(offenders(/\banimate-(?:spin|pulse|ping|bounce)\b|\binfinite\b/g, allow)).toEqual([]);
  });

  it("aucun mouvement ni changement d'échelle au survol", () => {
    expect(offenders(/\bhover:(?:-?translate-[xy]|scale|rotate)-/g)).toEqual([]);
    expect(offenders(/\bgroup-hover:(?:-?translate-[xy]|scale|rotate)-/g)).toEqual([]);
  });
});

describe("design-contract — motion et centrage par translate", () => {
  // Tailwind v4 compile `translate-x-*` / `-translate-y-*` vers la propriété CSS
  // `translate` (et non `transform`). Les keyframes de motion n'animent QUE
  // `transform` : les deux se composent, donc le centrage du Dialog
  // (`left-[50%] translate-x-[-50%]`) survit à `animation-fill-mode: both`.
  // Si un keyframe animait `translate`, il écraserait ce centrage.
  const globals = read("src/app/globals.css");
  const keyframes = (name: string) => {
    const start = globals.indexOf(`@keyframes ${name}`);
    expect(start, `@keyframes ${name}`).toBeGreaterThanOrEqual(0);
    let depth = 0;
    for (let i = globals.indexOf("{", start); i < globals.length; i++) {
      if (globals[i] === "{") depth++;
      if (globals[i] === "}" && --depth === 0) return globals.slice(start, i + 1);
    }
    throw new Error(`@keyframes ${name} non fermé`);
  };

  it("les keyframes kyb-enter / kyb-exit animent `transform`, jamais `translate`", () => {
    for (const name of ["kyb-enter", "kyb-exit"]) {
      const block = keyframes(name);
      expect(block, name).toMatch(/\btransform\s*:/);
      expect(block, name).not.toMatch(/(?<![\w-])translate\s*:/);
    }
  });

  it("le Dialog se centre avec les utilitaires translate (propriété `translate`)", () => {
    const dialog = read("src/components/ui/dialog.tsx");
    expect(dialog).toMatch(/translate-x-\[-50%\]/);
    expect(dialog).toMatch(/translate-y-\[-50%\]/);
    expect(dialog).not.toMatch(/\btransform-none\b|\[transform:/);
  });
});

describe("design-contract — typographie : aucune police ajoutée", () => {
  it("src/app/layout.tsx ne charge que Inter et Space Grotesk", () => {
    const layout = read("src/app/layout.tsx");
    const imports = [...layout.matchAll(/import\s*\{([^}]+)\}\s*from\s*"next\/font\/google"/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim()))
      .filter(Boolean)
      .sort();
    expect(imports).toEqual(["Inter", "Space_Grotesk"]);
  });

  it("les familles exposées à Tailwind sont celles du layout", () => {
    const globals = read("src/app/globals.css");
    expect(globals).toMatch(/--font-sans:\s*var\(--font-inter\);/);
    expect(globals).toMatch(/--font-display:\s*var\(--font-space-grotesk\);/);
  });

  it("les primitives n'imposent aucune famille de police en dur", () => {
    expect(offenders(/font-family\s*:|fontFamily\s*:|font-\[family-name:(?!var\(--font-display\))/g)).toEqual([]);
  });
});

describe("design-contract — documentation synchronisée", () => {
  const doc = read("DESIGN_SYSTEM.md");

  it("DESIGN_SYSTEM.md documente chaque token du contrat", () => {
    const css = read("src/styles/design-tokens.css");
    // Sections documentées une à une : 1–2 (thèmes) et 4 (échelles, motion).
    // La section 3 (rôles shadcn) et la 5 (alias historiques) sont décrites en bloc (§ 3.9).
    const between = (from: string, to: string) => css.slice(css.indexOf(from), css.indexOf(to));
    const body =
      between("1. THÈME SOMBRE", "3. RÔLES shadcn") + between("4. ÉCHELLES", "5. ALIAS HISTORIQUES");
    const tokens = (body.match(/^ {2}(--[a-z0-9-]+):/gm) ?? []).map((l) =>
      l.trim().replace(/:$/, ""),
    );
    expect(tokens.length).toBeGreaterThan(60);
    const undocumented = [...new Set(tokens)].filter((t) => !doc.includes(`\`${t}\``));
    expect(undocumented).toEqual([]);
  });

  it("DESIGN_SYSTEM.md cite chaque primitive", () => {
    for (const name of [
      "AppShell", "Sidebar", "TopBar", "PageHeader", "Card", "Panel", "MetricChip",
      "StatusBadge", "IconButton", "Tabs", "SegmentedControl", "DataTable",
      "EmptyState", "LoadingState", "ErrorState", "Tooltip", "Dialog", "SidePanel",
      "StatCard", "Reveal", "SidebarCount", "SessionStatus", "APP_NAV", "NativeSelect",
    ]) {
      expect(doc, name).toContain(name);
    }
  });
});

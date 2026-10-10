"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import BrandMark from "@/components/shell/BrandMark";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import ComponentGallery from "./ComponentGallery.client";
import { Section, Specimen } from "./Section";
import TokenSwatches from "./TokenSwatches.client";

const NAV = [
  ["principes", "Principes"],
  ["couleurs", "Couleurs"],
  ["typographie", "Typographie"],
  ["echelles", "Échelles"],
  ["coque", "Coque"],
  ["panneaux", "Panneaux"],
  ["statuts", "Statuts"],
  ["actions", "Actions"],
  ["navigation", "Navigation"],
  ["donnees", "Données"],
  ["surcouches", "Surcouches"],
  ["motion", "Motion"],
  ["interdits", "Interdits"],
] as const;

const FORBIDDEN = [
  "Un littéral de couleur (hex, rgb, hsl) dans un composant — toujours un token.",
  "Une teinte de risque pour autre chose qu'un niveau de risque (l'accent n'est jamais « ok » ni « danger »).",
  "Une information portée par la couleur seule : libellé, icône ou style de trait en plus.",
  "Un dégradé de surface arc-en-ciel, un violet de marque, un verre dépoli blanc, du néomorphisme.",
  "Une illustration décorative sans fonction de lecture.",
  "Une animation qui boucle sur un contenu opérationnel (seuls le pulse du squelette et le spinner de chargement le font).",
  "Un déplacement ou un changement d'échelle au survol.",
  "Une ombre sans élévation correspondante : utiliser les paliers xs / sm / md / lg.",
  "Un z-index brut : utiliser les paliers `--z-*`.",
  "Une autre police que celles déjà chargées par src/app/layout.tsx.",
];

export default function DesignSystemPreview() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[var(--layout-page-max)] flex-wrap items-center gap-x-6 gap-y-2 px-[var(--layout-page-gutter)] py-3">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-semibold">KYB Graph</span>
            <span className="text-eyebrow">Design system</span>
          </div>
          <nav aria-label="Sections" className="order-3 w-full md:order-none md:w-auto md:flex-1">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {NAV.map(([id, label]) => (
                <li key={id}>
                  <a className="transition-ui hover:text-foreground" href={`#${id}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <SegmentedControl
            label="Thème"
            size="sm"
            value={theme ?? "dark"}
            onValueChange={setTheme}
            options={[
              { value: "dark", label: "Sombre", icon: Moon },
              { value: "light", label: "Clair", icon: Sun },
              { value: "system", label: "Système", icon: Monitor },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[var(--layout-page-max)] px-[var(--layout-page-gutter)] py-10">
        <Section
          id="principes"
          title="Un contrat, pas un thème"
          description={
            <>
              Console d&apos;investigation et de conformité : sombre, précise, institutionnelle.
              Les valeurs vivent dans <code className="font-mono text-foreground">src/styles/design-tokens.css</code> ;
              les règles dans <code className="font-mono text-foreground">DESIGN_SYSTEM.md</code>.
              Cette page est interne (non indexée, non liée).
            </>
          }
        >
          <ul className="grid gap-3 text-sm md:grid-cols-3">
            {[
              ["Profondeur par superposition", "Du puits à la surcouche : cinq surfaces d'un bleu nuit froid, jamais un aplat gris."],
              ["Un accent, cinq teintes de risque", "Cyan pour agir, sélectionner, signaler l'actif. Succès, vigilance, critique, information, neutre — constants partout."],
              ["Dense mais lisible", "AA partout, 4 px de grille, chiffres tabulaires, mouvement de 120–220 ms qui respecte les préférences système."],
            ].map(([title, body]) => (
              <li key={title} className="rounded-lg border border-border bg-surface p-4">
                <p className="font-display text-sm font-semibold">{title}</p>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="couleurs"
          title="Couleurs"
          description="Valeurs lues en direct sur <html> : changez le thème en haut de page. Chaque texte affiche son contraste réel sur le fond (AA = 4,5:1)."
        >
          <TokenSwatches />
        </Section>

        <Section
          id="typographie"
          title="Typographie"
          description="Aucune nouvelle police : Inter (texte, interface) et Space Grotesk (titres d'affichage) restent celles de l'application, avec leurs graisses d'usage 400 / 500 / 600 / 700. Pile monospace système pour les empreintes, digests et raccourcis."
        >
          <Specimen label="Affichage — Space Grotesk" className="block space-y-2">
            <p className="font-display text-3xl font-bold">Cartographie de conformité KYB</p>
            <p className="font-display text-2xl font-bold">Titre de page — 2xl bold</p>
            <p className="font-display text-xl font-semibold">Titre de section — xl semibold</p>
            <p className="font-display text-lg font-semibold">Titre de panneau — lg semibold</p>
            <p className="font-display text-sm font-semibold">Titre de carte dense — sm semibold</p>
          </Specimen>
          <Specimen label="Texte — Inter" className="block space-y-1.5">
            <p className="text-base">Corps de lecture — base 16 px : prouver ce que l&apos;on sait.</p>
            <p className="text-sm">Corps d&apos;interface — sm 14 px : signaler ce qui reste à vérifier.</p>
            <p className="text-sm font-medium">Libellé de contrôle — sm 14 px medium.</p>
            <p className="text-xs text-muted-foreground">Aide / métadonnée — xs 12 px, texte secondaire.</p>
            <p className="text-micro text-subtle">Micro — 11 px, texte tertiaire (légendes, unités).</p>
            <p className="text-eyebrow">Légende en capitales (text-eyebrow)</p>
          </Specimen>
          <Specimen label="Chiffres et empreintes" className="block space-y-1.5">
            <p className="text-sm tabular-nums">Chiffres tabulaires : 1 111 · 2 222 · 3 333 — alignés en colonne.</p>
            <p className="font-mono text-xs text-muted-foreground">sha256 9f2c…a41e · digest 1428393849</p>
          </Specimen>
        </Section>

        <Section
          id="echelles"
          title="Échelles : espacement, rayons, élévations, profondeur"
          description="Grille de 4 px. Rayons : contrôles 6 px, panneaux 8 px, surcouches 12 px. Élévations profondes mais discrètes. Les z-index sont des paliers, jamais des valeurs brutes."
        >
          <Specimen label="Espacement — --space-1 … --space-12 (×4 px)" className="items-end">
            {[1, 2, 3, 4, 6, 8, 12].map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div
                  className="rounded-sm bg-primary/70"
                  style={{ width: `var(--space-${n})`, height: `var(--space-${n})` }}
                />
                <span className="font-mono text-micro text-subtle">
                  {n} · {n * 4}
                </span>
              </div>
            ))}
          </Specimen>
          <Specimen label="Rayons">
            {(
              [
                ["sm · 4 px", "rounded-sm"],
                ["md · 6 px", "rounded-md"],
                ["lg · 8 px", "rounded-lg"],
                ["xl · 12 px", "rounded-xl"],
                ["full", "rounded-full"],
              ] as const
            ).map(([label, cls]) => (
              <div
                key={label}
                className={`flex size-16 items-center justify-center border border-border-strong bg-surface-2 font-mono text-micro text-muted-foreground ${cls}`}
              >
                {label}
              </div>
            ))}
          </Specimen>
          <Specimen label="Élévations" className="gap-5">
            {(
              [
                ["xs", "shadow-xs"],
                ["sm", "shadow-sm"],
                ["md", "shadow-md"],
                ["lg", "shadow-lg"],
                ["glow", "shadow-glow"],
              ] as const
            ).map(([label, cls]) => (
              <div
                key={label}
                className={`flex size-20 items-center justify-center rounded-lg border border-border bg-surface-2 font-mono text-micro text-muted-foreground ${cls}`}
              >
                {label}
              </div>
            ))}
          </Specimen>
          <Specimen label="Profondeur (z-index)" className="block">
            <table className="w-full max-w-md text-sm">
              <tbody>
                {(
                  [
                    ["--z-base", "0", "contenu"],
                    ["--z-raised", "10", "en-tête de tableau collant"],
                    ["--z-sticky", "20", "topbar, en-têtes collants"],
                    ["--z-floating", "30", "panneaux flottants du graphe"],
                    ["--z-overlay", "50", "menus, dialogues, tiroirs, tooltips"],
                    ["--z-toast", "60", "notifications"],
                    ["--z-skip-link", "100", "lien d'évitement"],
                  ] as const
                ).map(([token, value, use]) => (
                  <tr key={token} className="border-b border-border-subtle last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-xs text-foreground">{token}</td>
                    <td className="py-1.5 pr-4 font-mono text-xs text-muted-foreground tabular-nums">{value}</td>
                    <td className="py-1.5 text-muted-foreground">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Specimen>
          <Specimen label="Breakpoints">
            {(
              [
                ["sm", "640 px", "—"],
                ["md", "768 px", "la sidebar remplace le tiroir"],
                ["lg", "1024 px", "panneaux latéraux persistants"],
                ["xl", "1280 px", "tables denses sans défilement"],
                ["2xl", "1536 px", "contenu plafonné (72 rem)"],
              ] as const
            ).map(([name, px, use]) => (
              <StatusBadge key={name} tone="neutral" dot={false} className="gap-2">
                <span className="font-mono">{name}</span> {px} · {use}
              </StatusBadge>
            ))}
          </Specimen>
        </Section>

        <ComponentGallery />

        <Section
          id="interdits"
          title="Interdits"
          description="Garde-fous vérifiés par design-contract.spec.ts quand ils sont automatisables."
        >
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {FORBIDDEN.map((rule) => (
              <li
                key={rule}
                className="flex gap-3 rounded-md border border-border bg-surface px-3 py-2 text-muted-foreground"
              >
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tone-critical" />
                {rule}
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}

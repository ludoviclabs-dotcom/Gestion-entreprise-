"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { compositeOver, contrastRatio, toHex, type Rgb } from "@/lib/design/color";

/**
 * Pastilles de couleur LUES EN DIRECT sur `<html>` : la valeur affichée est
 * celle du thème courant (contrat : src/styles/design-tokens.css). Aucune valeur
 * n'est dupliquée ici — seulement des noms de tokens. La conversion en sRGB passe
 * par un <canvas> : le navigateur résout n'importe quelle syntaxe CSS
 * (oklch, lab, hex, color-mix…) sans parseur maison.
 */

interface TokenDef {
  name: string;
  role: string;
  /** Teste le contraste de cette couleur utilisée COMME TEXTE sur --background. */
  text?: boolean;
}

const GROUPS: { title: string; tokens: TokenDef[] }[] = [
  {
    title: "Surfaces — profondeur par superposition",
    tokens: [
      { name: "--canvas-sunken", role: "Puits : champs, scène, code" },
      { name: "--background", role: "Toile de fond de l'application" },
      { name: "--surface", role: "Panneau / carte — niveau 1" },
      { name: "--surface-2", role: "Surélevé : survol, onglet actif — niveau 2" },
      { name: "--surface-3", role: "Surcouche : menu, dialogue, tiroir — niveau 3" },
      { name: "--sidebar", role: "Barre latérale" },
      { name: "--overlay", role: "Voile derrière un modal" },
    ],
  },
  {
    title: "Texte",
    tokens: [
      { name: "--foreground", role: "Texte principal", text: true },
      { name: "--muted-foreground", role: "Texte secondaire", text: true },
      { name: "--foreground-subtle", role: "Tertiaire / métadonnées", text: true },
      { name: "--foreground-disabled", role: "Désactivé (exempté de contraste)" },
    ],
  },
  {
    title: "Bordures froides",
    tokens: [
      { name: "--border-subtle", role: "Séparateur discret (lignes de tableau)" },
      { name: "--border", role: "Filet par défaut" },
      { name: "--border-strong", role: "Bordure appuyée (carte surélevée, bouton outline)" },
      { name: "--border-control", role: "Frontière de champ — ≥ 3:1" },
    ],
  },
  {
    title: "Action, focus, sélection, signal actif",
    tokens: [
      { name: "--primary", role: "Action · focus · sélection · connexion confirmée", text: true },
      { name: "--primary-hover", role: "Survol de l'action" },
      { name: "--primary-foreground", role: "Texte sur aplat d'accent" },
    ],
  },
  {
    title: "Teintes sémantiques de risque",
    tokens: [
      { name: "--tone-success", role: "Succès / prêt", text: true },
      { name: "--tone-vigilance", role: "Vigilance / à vérifier", text: true },
      { name: "--tone-critical", role: "Critique", text: true },
      { name: "--tone-info", role: "Information", text: true },
      { name: "--tone-neutral", role: "Neutre", text: true },
      { name: "--on-tone", role: "Texte sur aplat de teinte" },
    ],
  },
  {
    title: "Niveaux de preuve (traits)",
    tokens: [
      { name: "--proof-confirmed", role: "Confirmé" },
      { name: "--proof-declared", role: "Déclaré" },
      { name: "--proof-inferred", role: "Inféré" },
      { name: "--proof-simulated", role: "Simulé" },
    ],
  },
];

const ALL_NAMES = GROUPS.flatMap((g) => g.tokens.map((t) => t.name));

type Rgba = [number, number, number, number];

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

let probe: CanvasRenderingContext2D | null | undefined;

/** Résout une valeur CSS quelconque en [r, g, b, a] (0–255) via un canvas 1×1. */
function resolveColor(value: string): Rgba | null {
  if (probe === undefined) {
    probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  }
  if (!probe || !value || !CSS.supports("color", value)) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

/** Snapshot sérialisé (comparaison par valeur → pas de re-rendu inutile). */
function readTokens(): string {
  const style = getComputedStyle(document.documentElement);
  const out: Record<string, Rgba | null> = {};
  for (const name of ALL_NAMES) out[name] = resolveColor(style.getPropertyValue(name).trim());
  return JSON.stringify(out);
}

export default function TokenSwatches() {
  const raw = useSyncExternalStore(subscribe, readTokens, () => "{}");
  const values = JSON.parse(raw) as Record<string, Rgba | null>;
  const bgRgba = values["--background"];
  const backdrop: Rgb | null = bgRgba ? [bgRgba[0], bgRgba[1], bgRgba[2]] : null;

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-eyebrow mb-3">{group.title}</p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
            {group.tokens.map((token) => {
              const rgba = values[token.name];
              const alpha = rgba ? rgba[3] : null;
              const flat: Rgb | null =
                rgba && backdrop
                  ? alpha !== null && alpha < 1
                    ? compositeOver({ rgb: [rgba[0], rgba[1], rgba[2]], alpha, inGamut: true }, backdrop)
                    : [rgba[0], rgba[1], rgba[2]]
                  : null;
              const ratio = token.text && flat && backdrop ? contrastRatio(flat, backdrop) : null;
              return (
                <li
                  key={token.name}
                  className="overflow-hidden rounded-lg border border-border bg-surface"
                >
                  <div
                    className="flex h-14 items-center justify-between border-b border-border px-3"
                    style={{ background: token.text ? "var(--background)" : `var(${token.name})` }}
                  >
                    {token.text ? (
                      <span
                        className="font-display text-xl font-semibold"
                        style={{ color: `var(${token.name})` }}
                      >
                        Aa
                      </span>
                    ) : (
                      <span className="text-micro text-subtle">
                        {token.name.replace(/^--/, "")}
                      </span>
                    )}
                    {ratio !== null ? (
                      <span
                        className={cn(
                          "rounded-sm border px-1.5 py-0.5 font-mono text-micro",
                          ratio >= 4.5
                            ? "border-tone-success/40 text-tone-success"
                            : "border-tone-critical/40 text-tone-critical",
                        )}
                      >
                        {ratio.toFixed(1)}:1
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-0.5 px-3 py-2">
                    <p className="font-mono text-xs text-foreground">{token.name}</p>
                    <p className="text-xs text-muted-foreground">{token.role}</p>
                    <p className="font-mono text-micro text-subtle">
                      {rgba
                        ? `${toHex([rgba[0], rgba[1], rgba[2]])}${
                            alpha !== null && alpha < 1
                              ? ` · ${Math.round(alpha * 100)} % → ≈ ${flat ? toHex(flat) : "—"} sur le fond`
                              : ""
                          }`
                        : "—"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

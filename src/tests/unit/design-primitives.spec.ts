// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Fragment, act, createElement as h, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Inbox, X } from "lucide-react";

import AppShell from "@/components/shell/AppShell";
import { SidebarCount, SidebarItem, SidebarNav } from "@/components/shell/Sidebar";
import TopBar, { OPEN_COMMAND_EVENT } from "@/components/shell/TopBar";
import { isApplePlatform } from "@/components/shell/useModKey";
import { Reveal } from "@/components/ui/reveal";
import { StatCard } from "@/components/ui/stat-card";
import PageHeader from "@/components/shell/PageHeader";
import EmptyState from "@/components/empty/EmptyState";
import ErrorState from "@/components/empty/ErrorState";
import LoadingState from "@/components/empty/LoadingState";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { MetricChip } from "@/components/ui/metric-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidePanel } from "@/components/ui/side-panel";
import { StatusBadge } from "@/components/ui/status-badge";

/**
 * Comportement des primitives du design system : accessibilité (focus piégé,
 * Échap, noms accessibles, rôles) et contrat de rendu des états. Le rendu
 * visuel et les contrastes sont couverts par design-tokens.spec.ts.
 */

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom n'implémente pas ResizeObserver (Radix Popper / Tooltip).
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  document.body.innerHTML = "";
  root = null;
  host = null;
});

function mount(ui: ReactElement): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(ui);
  });
  return host;
}

const html = (ui: ReactElement) => renderToStaticMarkup(ui);
const press = (key: string, target: EventTarget = document) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
const click = (el: Element | null) =>
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

describe("Dialog — modal accessible", () => {
  function Harness({ onChange }: { onChange: (open: boolean) => void }) {
    const [open, setOpen] = useState(false);
    return h(
      Fragment,
      null,
      h("button", { id: "outside" }, "Hors dialogue"),
      h(
        Dialog,
        {
          open,
          onOpenChange: (next: boolean) => {
            setOpen(next);
            onChange(next);
          },
        },
        h(DialogTrigger, { asChild: true }, h("button", { id: "trigger" }, "Ouvrir")),
        h(
          DialogContent,
          null,
          h(
            DialogHeader,
            null,
            h(DialogTitle, null, "Archiver ce dossier ?"),
            h(DialogDescription, null, "Action réversible."),
          ),
          h("button", { id: "inside-a" }, "Confirmer"),
        ),
      ),
    );
  }

  it("s'ouvre, déplace le focus à l'intérieur et se nomme par son titre", async () => {
    const onChange = vi.fn();
    mount(h(Harness, { onChange }));
    expect(dialog()).toBeNull();

    click(document.getElementById("trigger"));
    await settle();

    const d = dialog();
    expect(d).not.toBeNull();
    expect(d?.contains(document.activeElement)).toBe(true);
    const labelId = d?.getAttribute("aria-labelledby");
    expect(document.getElementById(labelId ?? "")?.textContent).toBe("Archiver ce dossier ?");
  });

  it("piège le focus : un élément extérieur ne le garde pas", async () => {
    mount(h(Harness, { onChange: () => {} }));
    click(document.getElementById("trigger"));
    await settle();

    act(() => document.getElementById("outside")?.focus());
    await settle();
    expect(dialog()?.contains(document.activeElement)).toBe(true);
  });

  it("se ferme avec Échap et rend le focus au déclencheur", async () => {
    const onChange = vi.fn();
    mount(h(Harness, { onChange }));
    click(document.getElementById("trigger"));
    await settle();

    press("Escape");
    await settle();

    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(document.getElementById("trigger"));
  });
});

describe("SidePanel — tiroir modal et panneau d'inspection", () => {
  function Panel({ modal, onChange }: { modal: boolean; onChange: (open: boolean) => void }) {
    const [open, setOpen] = useState(true);
    return h(SidePanel, {
      open,
      modal,
      title: "Inspecteur de preuve",
      description: "Source officielle",
      onOpenChange: (next: boolean) => {
        setOpen(next);
        onChange(next);
      },
      children: h("p", null, "Contenu"),
    });
  }

  it("modal : voile présent, focus à l'intérieur, Échap ferme", async () => {
    const onChange = vi.fn();
    mount(h(Panel, { modal: true, onChange }));
    await settle();

    expect(document.querySelector('[data-slot="sheet-overlay"]')).not.toBeNull();
    const d = dialog();
    expect(d?.getAttribute("data-slot")).toBe("side-panel");
    expect(d?.contains(document.activeElement)).toBe(true);

    press("Escape");
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(dialog()).toBeNull();
  });

  it("non modal : aucun voile, Échap ferme quand même", async () => {
    const onChange = vi.fn();
    mount(h(Panel, { modal: false, onChange }));
    await settle();

    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(dialog()).not.toBeNull();

    press("Escape");
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("le bouton de fermeture a un nom accessible et ferme le panneau", async () => {
    const onChange = vi.fn();
    mount(h(Panel, { modal: true, onChange }));
    await settle();

    const close = dialog()?.querySelector('button[aria-label="Fermer le panneau"]') ?? null;
    expect(close).not.toBeNull();

    click(close);
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(dialog()).toBeNull();
  });
});

describe("SegmentedControl — choix exclusif", () => {
  function Harness({ onValueChange }: { onValueChange: (v: string) => void }) {
    const [value, setValue] = useState("liste");
    return h(SegmentedControl, {
      label: "Mode d'affichage",
      value,
      onValueChange: (v: string) => {
        setValue(v);
        onValueChange(v);
      },
      options: [
        { value: "liste", label: "Liste" },
        { value: "carte", label: "Cartes" },
      ],
    });
  }

  it("expose un groupe nommé et sélectionne la valeur cliquée", () => {
    const spy = vi.fn();
    const el = mount(h(Harness, { onValueChange: spy }));
    const group = el.querySelector('[data-slot="segmented-control"]');
    expect(group?.getAttribute("aria-label")).toBe("Mode d'affichage");

    const items = el.querySelectorAll('[data-slot="segmented-control-item"]');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute("data-state")).toBe("on");

    click(items[1]);
    expect(spy).toHaveBeenCalledWith("carte");
    expect(items[1].getAttribute("data-state")).toBe("on");
  });

  it("ne désélectionne jamais : un second clic sur l'actif n'émet rien", () => {
    const spy = vi.fn();
    const el = mount(h(Harness, { onValueChange: spy }));
    const items = el.querySelectorAll('[data-slot="segmented-control-item"]');
    click(items[0]);
    expect(spy).not.toHaveBeenCalled();
    expect(items[0].getAttribute("data-state")).toBe("on");
  });
});

describe("StatusBadge · MetricChip · IconButton", () => {
  it("StatusBadge : libellé toujours présent, teinte et point exposés", () => {
    const out = html(h(StatusBadge, { tone: "critical", children: "Critique" }));
    expect(out).toContain("Critique");
    expect(out).toContain('data-tone="critical"');
    expect(out).toContain("text-tone-critical");
    expect(out).toContain("bg-current"); // point de statut
  });

  it("StatusBadge : une icône remplace le point par défaut", () => {
    const out = html(h(StatusBadge, { tone: "success", icon: Inbox, children: "Prêt" }));
    expect(out).not.toContain("bg-current");
    expect(out).toContain("<svg");
  });

  it("MetricChip : libellé + valeur + unité, chiffres tabulaires", () => {
    const out = html(h(MetricChip, { label: "Vigilance", value: 72, unit: "/100", tone: "critical" }));
    expect(out).toContain("Vigilance");
    expect(out).toContain("72");
    expect(out).toContain("/100");
    expect(out).toContain("tabular-nums");
    expect(out).toContain("text-tone-critical");
  });

  it("IconButton : nom accessible obligatoire et état bascule", () => {
    const out = html(h(IconButton, { label: "Fermer", icon: X, tooltip: false, pressed: true }));
    expect(out).toContain('aria-label="Fermer"');
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain('aria-hidden="true"'); // l'icône est décorative
  });
});

describe("États : vide, chargement, erreur", () => {
  it("LoadingState : rôle status, occupé, libellé lisible par les lecteurs d'écran", () => {
    const out = html(h(LoadingState, { label: "Chargement du dossier…" }));
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain("Chargement du dossier…");
  });

  it("ErrorState : rôle alert, message sobre, action en slot, digest en mono", () => {
    const out = html(
      h(ErrorState, {
        title: "Source indisponible",
        description: "Réessayez dans un instant.",
        digest: "abc123",
        action: h("button", null, "Réessayer"),
      }),
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("Source indisponible");
    expect(out).toContain("Digest abc123");
    expect(out).toContain("Réessayer");
  });

  it("EmptyState : titre, description, action ; `good` = teinte de succès", () => {
    const out = html(
      h(EmptyState, { icon: Inbox, title: "Rien à signaler", description: "Aucun signal.", tone: "good" }),
    );
    expect(out).toContain("Rien à signaler");
    expect(out).toContain("tone-success");
  });
});

describe("DataTable — coque et états au même emplacement", () => {
  const body = h("table", null, h("tbody", null, h("tr", null, h("td", null, "ligne"))));

  it("ready : affiche le contenu, barre d'outils et pied", () => {
    const out = html(h(DataTable, { toolbar: "outils", footer: "pied" }, body));
    expect(out).toContain("ligne");
    expect(out).toContain("outils");
    expect(out).toContain("pied");
    expect(out).toContain('data-state="ready"');
  });

  it("loading : annonce le chargement et marque la région occupée", () => {
    const out = html(h(DataTable, { state: "loading", label: "Dossiers" }, body));
    expect(out).not.toContain("ligne");
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('role="status"');
    expect(out).toContain('role="region"');
  });

  it("empty et error : contenu de repli, sans le tableau", () => {
    const empty = html(h(DataTable, { state: "empty" }, body));
    expect(empty).toContain('data-slot="empty-state"');
    expect(empty).not.toContain("ligne");

    const error = html(h(DataTable, { state: "error" }, body));
    expect(error).toContain('role="alert"');
    expect(error).not.toContain("ligne");
  });

  it("contenus de repli personnalisables", () => {
    const out = html(h(DataTable, { state: "empty", empty: h("p", null, "Aucun dossier") }, body));
    expect(out).toContain("Aucun dossier");
  });
});

describe("Coque : AppShell · Sidebar · PageHeader", () => {
  it("AppShell : lien d'évitement vers la région principale", () => {
    const out = html(
      h(AppShell, {
        sidebar: h("aside", null, "nav"),
        topbar: h("header", null, "top"),
        children: "contenu",
      }),
    );
    expect(out).toContain('href="#contenu"');
    expect(out).toContain('id="contenu"');
    expect(out).toContain("<main");
    expect(out).toContain("Aller au contenu principal");
  });

  it("SidebarItem actif : aria-current=page", () => {
    const active = html(
      h(SidebarItem, { href: "/dashboard", active: true, children: "Tableau de bord" }),
    );
    expect(active).toContain('aria-current="page"');
    const idle = html(h(SidebarItem, { href: "/cases", children: "Dossiers" }));
    expect(idle).not.toContain("aria-current");
  });

  it("PageHeader : un seul h1, description et actions", () => {
    const out = html(
      h(PageHeader, { title: "Dossiers", description: "Tous vos dossiers.", actions: h("button", null, "Nouveau") }),
    );
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain("Tous vos dossiers.");
    expect(out).toContain("Nouveau");
  });
});

describe("Shell : Sidebar (états, clavier) · Topbar (recherche globale)", () => {
  it("SidebarItem désactivé : pas de lien, aria-disabled, jamais aria-current", () => {
    const out = html(h(SidebarItem, { href: "/reglages", disabled: true, active: true, children: "Réglages" }));
    expect(out).toContain('aria-disabled="true"');
    expect(out).not.toContain("href=");
    expect(out).not.toContain("aria-current");
  });

  it("SidebarItem : libellé complet = nom accessible, libellé court du rail masqué aux lecteurs d'écran", () => {
    const out = html(
      h(SidebarItem, { href: "/secteurs", shortLabel: "Secteurs", children: "Secteurs 2026" }),
    );
    expect(out).toContain("Secteurs 2026");
    expect(out).toMatch(/<span aria-hidden="true"[^>]*>Secteurs<\/span>/);
  });

  it("SidebarCount : le chiffre est complété pour les lecteurs d'écran", () => {
    const out = html(h(SidebarCount, { value: 3, srLabel: "dossiers à revoir", tone: "critical" }));
    expect(out).toContain("3");
    expect(out).toMatch(/class="sr-only"> dossiers à revoir/);
  });

  it("SidebarNav : ↓ ↑ Début Fin déplacent le focus, en sautant les entrées désactivées", () => {
    const root = mount(
      h(SidebarNav, {
        label: "Navigation principale",
        children: [
          h(SidebarItem, { key: "a", href: "/dashboard", children: "Tableau de bord" }),
          h(SidebarItem, { key: "b", href: "/cases", children: "Dossiers" }),
          h(SidebarItem, { key: "c", href: "/x", disabled: true, children: "Désactivé" }),
          h(SidebarItem, { key: "d", href: "/reglages", children: "Réglages" }),
        ],
      }),
    );
    const links = Array.from(root.querySelectorAll<HTMLElement>("a"));
    expect(links).toHaveLength(3);
    links[0].focus();
    press("ArrowDown", document.activeElement as HTMLElement);
    expect(document.activeElement?.textContent).toContain("Dossiers");
    press("ArrowDown", document.activeElement as HTMLElement);
    expect(document.activeElement?.textContent).toContain("Réglages");
    press("ArrowDown", document.activeElement as HTMLElement);
    expect(document.activeElement?.textContent).toContain("Tableau de bord");
    press("ArrowUp", document.activeElement as HTMLElement);
    expect(document.activeElement?.textContent).toContain("Réglages");
    press("Home", document.activeElement as HTMLElement);
    expect(document.activeElement?.textContent).toContain("Tableau de bord");
    press("End", document.activeElement as HTMLElement);
    expect(document.activeElement?.textContent).toContain("Réglages");
  });

  it("Topbar : recherche globale nommée, raccourci annoncé et visible, action « Nouveau dossier »", () => {
    const out = html(h(TopBar, { demoMode: true }));
    expect(out).toContain('aria-label="Recherche globale : dossier, SIREN ou page"');
    expect(out).toContain('aria-keyshortcuts="Control+K Meta+K"');
    expect(out).toMatch(/<kbd[^>]*>.*Ctrl.*K.*<\/kbd>/);
    expect(out).toContain('href="/cases/new"');
    expect(out).toContain("Nouveau dossier");
    expect(out).toContain('aria-label="Session : Mode démo"');
  });

  it("Topbar : le champ de recherche ouvre la palette (évènement global)", () => {
    const opened = vi.fn();
    window.addEventListener(OPEN_COMMAND_EVENT, opened);
    const root = mount(h(TopBar, { demoMode: false }));
    click(root.querySelector('[data-slot="global-search"]'));
    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_COMMAND_EVENT, opened);
  });

  it("raccourci : ⌘ sur les plateformes Apple, Ctrl ailleurs", () => {
    expect(isApplePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe(true);
    expect(isApplePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(true);
    expect(isApplePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
  });
});

describe("Tableau de bord : StatCard · Reveal", () => {
  it("StatCard : structure dl — libellé (dt), valeur et contexte (dd), lecture qualitative écrite", () => {
    const out = html(
      h(StatCard, {
        label: "Signaux élevés",
        value: 4,
        status: { tone: "critical", label: "À instruire" },
        context: "Sur 2 dossiers",
      }),
    );
    expect(out).toMatch(/<dl[^>]*>.*<dt[^>]*>.*Signaux élevés.*<\/dt>.*<dd[^>]*>4<\/dd>/);
    expect(out).toContain("À instruire");
    expect(out).toContain('data-tone="critical"');
    expect(out).toContain("Sur 2 dossiers");
    expect(out).not.toContain("<a");
  });

  it("StatCard : lien quand href, variation toujours accompagnée de sa référence", () => {
    const out = html(
      h(StatCard, {
        label: "Dossiers actifs",
        value: 12,
        href: "/cases",
        delta: { value: "+3", direction: "up", label: "vs 7 jours" },
      }),
    );
    expect(out).toContain('href="/cases"');
    expect(out).toMatch(/data-slot="stat-delta".*\+3.*vs 7 jours/);
  });

  it("Reveal : index borné, utilitaire CSS motion-reveal (aucun JavaScript)", () => {
    expect(html(h(Reveal, { index: 2, children: "x" }))).toMatch(/class="motion-reveal" style="--reveal-index:2"/);
    expect(html(h(Reveal, { index: 99, children: "x" }))).toContain("--reveal-index:5");
    expect(html(h(Reveal, { index: -3, as: "section", children: "x" }))).toMatch(/^<section[^>]*--reveal-index:0/);
  });
});

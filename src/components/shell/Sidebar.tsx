"use client";

import type { ComponentProps, KeyboardEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MOTION } from "@/lib/design/motion";
import { TONE_STYLES } from "@/lib/design/tone";

/**
 * Sidebar générique du design system : une COUCHE de navigation (pleine hauteur,
 * filet à droite, fond `sidebar`), jamais une carte flottante. Elle ne connaît ni
 * routes ni état : la navigation de l'application est assemblée dans
 * SidebarContent ; la version responsive dans AppSidebar / MobileSidebar.
 *
 *   <Sidebar collapsible="rail">
 *     <SidebarHeader>…marque…</SidebarHeader>
 *     <SidebarNav label="Navigation principale">
 *       <SidebarItem href icon shortLabel active badge>Libellé</SidebarItem>
 *     </SidebarNav>
 *   </Sidebar>
 *
 * `collapsible="rail"` : entre md et lg (tablette), la sidebar devient un rail
 * de 5 rem — icône AU-DESSUS d'un libellé court toujours visible (pas d'icône
 * seule). Les classes `rail:` ne s'appliquent qu'à l'intérieur de ce conteneur.
 */

export function Sidebar({
  collapsible = "none",
  className,
  ...props
}: ComponentProps<"aside"> & { collapsible?: "none" | "rail" }) {
  return (
    <aside
      data-slot="sidebar"
      data-collapsible={collapsible}
      className={cn(
        "flex h-full w-[var(--layout-sidebar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        collapsible === "rail" && "md:max-lg:w-[var(--layout-sidebar-rail-width)]",
        className,
      )}
      {...props}
    />
  );
}

/** En-tête : même hauteur que la Topbar pour que les filets s'alignent. */
export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 rail:justify-center rail:px-2",
        className,
      )}
      {...props}
    />
  );
}

const ITEM_SELECTOR = '[data-slot="sidebar-item"]:not([aria-disabled="true"])';

/**
 * Région de navigation. Clavier : Tab parcourt les entrées (ordre du DOM) ;
 * en complément, ↑ / ↓ passent à l'entrée précédente / suivante, Début / Fin à
 * la première / dernière.
 */
export function SidebarNav({
  label,
  className,
  onKeyDown,
  ...props
}: ComponentProps<"nav"> & { label: string }) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowDown"
            ? current < 0 || current === last ? 0 : current + 1
            : current <= 0 ? last : current - 1;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <nav
      aria-label={label}
      data-slot="sidebar-nav"
      onKeyDown={handleKeyDown}
      className={cn("flex-1 space-y-0.5 overflow-y-auto px-2 py-3", className)}
      {...props}
    />
  );
}

export function SidebarSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div data-slot="sidebar-section" className="space-y-0.5 pt-3 first:pt-0">
      {title ? <p className="text-eyebrow px-3 pb-1 rail:sr-only">{title}</p> : null}
      {children}
    </div>
  );
}

/**
 * Liseré d'accent de l'entrée active. Il GLISSE d'une entrée à l'autre au
 * changement de page (180 ms, `layoutId`) : c'est le seul mouvement de la
 * navigation. Sous `prefers-reduced-motion` (MotionConfig « user » posé par
 * SidebarContent), il saute directement à sa place.
 */
function ActiveIndicator({ layoutId }: { layoutId?: string }) {
  return (
    <motion.span
      aria-hidden
      layoutId={layoutId}
      transition={{ duration: MOTION.duration.base, ease: MOTION.ease.out }}
      className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
    />
  );
}

/**
 * Retour immédiat au clic quand la page cible n'est pas encore prête (route
 * dynamique non préchargée) : point d'accent à taille fixe, seule son opacité
 * change — aucun décalage de mise en page.
 */
function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={cn(
        "absolute top-1/2 right-2 size-1.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-ui rail:top-2 rail:translate-y-0",
        pending && "opacity-100",
      )}
    />
  );
}

/**
 * Entrée de navigation.
 *  - `active` : `aria-current="page"` + fond d'accent 10 % + liseré cyan + icône cyan ;
 *  - `disabled` : rendue sans lien (`aria-disabled`), atténuée, non focalisable ;
 *  - `badge` : compteur (doit contenir un texte lisible par les lecteurs d'écran) ;
 *  - `shortLabel` : libellé du rail tablette (le libellé complet reste le nom accessible) ;
 *  - `indicatorId` : identifiant partagé du liseré glissant (un par instance de nav).
 */
export function SidebarItem({
  href,
  icon: Icon,
  active = false,
  disabled = false,
  badge,
  shortLabel,
  indicatorId,
  onClick,
  children,
}: {
  href: string;
  icon?: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  shortLabel?: string;
  indicatorId?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    "group relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-ui outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    "rail:h-auto rail:flex-col rail:justify-center rail:gap-1 rail:px-1 rail:py-2 rail:text-center",
    disabled
      ? "cursor-not-allowed text-subtle opacity-[var(--opacity-disabled)]"
      : active
        ? "bg-primary/10 text-sidebar-foreground"
        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground active:bg-primary/10",
  );

  const content = (
    <>
      {active && !disabled ? <ActiveIndicator layoutId={indicatorId} /> : null}
      {Icon ? (
        <Icon
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 transition-ui rail:size-5",
            active && !disabled
              ? "text-primary"
              : "text-subtle group-hover:text-sidebar-foreground",
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate rail:sr-only">{children}</span>
      {shortLabel ? (
        <span aria-hidden className="hidden text-micro leading-tight rail:block">
          {shortLabel}
        </span>
      ) : null}
      {badge ? (
        <span className="shrink-0 rail:absolute rail:top-1 rail:right-1.5">{badge}</span>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <span data-slot="sidebar-item" aria-disabled="true" className={className}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-slot="sidebar-item"
      data-active={active || undefined}
      className={className}
    >
      {content}
      {badge ? null : <PendingHint />}
    </Link>
  );
}

/** Compteur d'une entrée (ex. dossiers à revoir). `srLabel` complète le chiffre pour les lecteurs d'écran. */
export function SidebarCount({
  value,
  srLabel,
  tone = "vigilance",
}: {
  value: number;
  srLabel: string;
  tone?: "vigilance" | "critical" | "neutral";
}) {
  return (
    <span
      data-slot="sidebar-count"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-micro font-semibold tabular-nums",
        TONE_STYLES[tone].soft,
      )}
    >
      {value}
      <span className="sr-only"> {srLabel}</span>
    </span>
  );
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("shrink-0 border-t border-sidebar-border p-3 rail:px-2", className)}
      {...props}
    />
  );
}

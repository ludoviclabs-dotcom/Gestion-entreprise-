import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Sidebar générique du design system. Elle ne connaît ni routes ni état : la
 * navigation de l'application (items, état actif) est assemblée dans
 * SidebarContent ; la version responsive (masquée < md, tiroir en mobile) dans
 * AppSidebar / MobileSidebar.
 *
 *   <Sidebar>
 *     <SidebarHeader>…marque…</SidebarHeader>
 *     <SidebarNav label="Navigation principale">
 *       <SidebarSection title="Analyse"> <SidebarItem …/> </SidebarSection>
 *     </SidebarNav>
 *     <SidebarFooter>…</SidebarFooter>
 *   </Sidebar>
 */

export function Sidebar({ className, ...props }: ComponentProps<"aside">) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "flex h-full w-[var(--layout-sidebar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
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
        "flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarNav({
  label,
  className,
  ...props
}: ComponentProps<"nav"> & { label: string }) {
  return (
    <nav
      aria-label={label}
      data-slot="sidebar-nav"
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
    <div data-slot="sidebar-section" className="space-y-0.5 first:pt-0 pt-3">
      {title ? <p className="text-eyebrow px-3 pb-1">{title}</p> : null}
      {children}
    </div>
  );
}

/**
 * Entrée de navigation. `active` pose `aria-current="page"` (lu par les
 * technologies d'assistance) ET le signal visuel : fond accent 10 % + liseré
 * d'accent à gauche + icône d'accent.
 */
export function SidebarItem({
  href,
  icon: Icon,
  active = false,
  badge,
  onClick,
  children,
}: {
  href: string;
  icon?: LucideIcon;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-slot="sidebar-item"
      data-active={active || undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-ui",
        active
          ? "bg-primary/10 text-sidebar-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {Icon ? (
        <Icon
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 transition-ui",
            active ? "text-primary" : "text-subtle group-hover:text-sidebar-foreground",
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
    </Link>
  );
}

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("shrink-0 border-t border-sidebar-border p-3", className)}
      {...props}
    />
  );
}

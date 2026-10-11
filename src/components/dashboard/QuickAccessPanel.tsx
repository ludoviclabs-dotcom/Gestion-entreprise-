import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { APP_NAV } from "@/components/shell/nav";

/**
 * Accès rapides : où trouver chaque espace (Dossiers, Transactions, Secteurs,
 * Réglages), avec ce qu'on y fait. Même source que la sidebar (APP_NAV).
 */
export default function QuickAccessPanel() {
  const destinations = APP_NAV.filter((item) => item.href !== "/dashboard");
  return (
    <Panel role="region" aria-labelledby="quick-access-title" className="h-full">
      <PanelHeader>
        <div className="min-w-0">
          <PanelTitle as="h2" id="quick-access-title">
            Accès rapides
          </PanelTitle>
          <PanelDescription>Les espaces de travail et ce qu&apos;on y trouve.</PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="p-2">
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
          {destinations.map(({ href, label, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-start gap-3 rounded-md border border-transparent p-3 transition-ui outline-none hover:border-primary/40 hover:bg-surface-2/60 hover:shadow-glow focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-subtle transition-ui group-hover:border-primary/40 group-hover:text-primary">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                    {label}
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 text-subtle opacity-0 transition-ui group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelBody>
    </Panel>
  );
}

"use client";

import Link from "next/link";
import { BookOpenText, Settings, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { TONE_STYLES } from "@/lib/design/tone";
import { cn } from "@/lib/utils";

/**
 * Statut de la session dans la Topbar : qui travaille, sur quelles données.
 * L'application n'a pas encore d'authentification (Better-Auth, étape 2.2) : on
 * l'affiche honnêtement plutôt que d'inventer une identité. Le mode d'exécution
 * (démonstration / live) reprend le libellé de la page Réglages.
 */
export default function SessionStatus({ demoMode }: { demoMode: boolean }) {
  const tone = demoMode ? "vigilance" : "success";
  const modeLabel = demoMode ? "Mode démo" : "Mode live";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Session : ${modeLabel}`}
          data-slot="session-status"
          className="group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent pr-2 pl-1 text-sm text-muted-foreground transition-ui outline-none hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-2 data-[state=open]:border-primary/50 data-[state=open]:text-foreground"
        >
          <span className="relative flex size-7 items-center justify-center rounded-full border border-border bg-surface-2">
            <UserRound aria-hidden className="size-4 text-subtle group-hover:text-foreground" />
            <span
              aria-hidden
              className={cn(
                "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
                TONE_STYLES[tone].dot,
              )}
            />
          </span>
          <span className="hidden font-medium lg:inline">{modeLabel}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-eyebrow">Session de travail</DropdownMenuLabel>
        <div className="space-y-2 px-2 pb-2 text-sm">
          <StatusBadge tone={tone}>{demoMode ? "Démonstration" : "Live"}</StatusBadge>
          <p className="text-muted-foreground">
            {demoMode
              ? "Les connecteurs renvoient des données de démonstration (fixtures)."
              : "Les connecteurs interrogent les API officielles en temps réel."}
          </p>
          <p className="text-xs text-subtle">
            Aucun compte utilisateur : l&apos;authentification n&apos;est pas encore activée sur cet
            environnement.
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reglages">
            <Settings aria-hidden /> Réglages et sources
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/ressources">
            <BookOpenText aria-hidden /> Ancrages réglementaires
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

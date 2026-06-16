"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import {
  GLOSSARY,
  type GlossaryEntry,
  type GlossaryId,
} from "@/lib/domain/glossaire";

/**
 * Terme de glossaire : souligne discrètement un terme technique et révèle sa
 * définition sobre au survol (pattern P5). Dégrade proprement si l'id est
 * inconnu (rend simplement le texte). Réutilise le Tooltip Radix du design system.
 */
export function GlossaryTerm({
  id,
  children,
}: {
  id: GlossaryId;
  children?: React.ReactNode;
}) {
  const entry = GLOSSARY[id] as GlossaryEntry | undefined;
  if (!entry) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"
          >
            {children ?? entry.term}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left">
          <span className="font-semibold">{entry.term}.</span> {entry.definition}
          {entry.ref ? (
            <span className="mt-1 block text-background/70">{entry.ref}</span>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

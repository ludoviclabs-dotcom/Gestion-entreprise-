import { ExternalLink } from "lucide-react";
import type { RegRef } from "@/lib/domain/regulatory-refs";

/**
 * Ancrage réglementaire daté et lié vers un texte officiel.
 * Réutilisé par /ressources, /souverainete et /confidentialite.
 */
export function RegulatoryAnchor({ source }: { source: RegRef }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-1 rounded-lg border border-border bg-background p-3 transition hover:border-violet/40"
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {source.label}
        <ExternalLink
          size={13}
          className="shrink-0 opacity-60 transition group-hover:opacity-100"
        />
      </span>
      <span className="text-xs text-muted-foreground">{source.date}</span>
      {source.note ? (
        <span className="text-xs leading-5 text-muted-foreground">
          {source.note}
        </span>
      ) : null}
    </a>
  );
}

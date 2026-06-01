"use client";

import { Download, FileText, FileJson } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Menu d'export du dossier (PDF / JSON pour l'instant, PNG via la toolbar du graphe).
 * Chaque action déclenche un téléchargement via une route serveur et signale
 * l'utilisateur via un toast.
 */
export default function ExportMenu({ caseId }: { caseId: string }) {
  const triggerDownload = (path: string, label: string) => {
    toast.success(`Téléchargement de ${label}…`);
    window.location.href = path;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted-foreground transition hover:text-foreground"
          aria-label="Exporter le dossier"
        >
          <Download size={15} />
          Exporter
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Formats disponibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => triggerDownload(`/cases/${caseId}/export/pdf`, "rapport PDF")}
        >
          <FileText size={15} />
          Rapport PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => triggerDownload(`/cases/${caseId}/export/json`, "manifeste JSON")}
        >
          <FileJson size={15} />
          Manifeste JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useState } from "react";
import { Download, FileText, FileJson, FileArchive } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

/**
 * Menu d'export du dossier (PDF / JSON / pack de preuve ZIP — PNG via la
 * toolbar du graphe). « Masquer les personnes » applique la redaction-light
 * (`?redact=persons`) aux trois formats. Chaque action déclenche un
 * téléchargement via une route serveur et signale l'utilisateur via un toast.
 */
export default function ExportMenu({ caseId }: { caseId: string }) {
  const [redactPersons, setRedactPersons] = useState(false);

  const triggerDownload = (format: string, label: string) => {
    toast.success(`Téléchargement de ${label}…`);
    const suffix = redactPersons ? "?redact=persons" : "";
    window.location.href = `/cases/${caseId}/export/${format}${suffix}`;
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Formats disponibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => triggerDownload("pdf", "rapport PDF")}>
          <FileText size={15} />
          Rapport PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => triggerDownload("json", "manifeste JSON")}
        >
          <FileJson size={15} />
          Manifeste JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => triggerDownload("pack", "pack de preuve (ZIP)")}
        >
          <FileArchive size={15} />
          Pack de preuve (ZIP)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={redactPersons}
          onCheckedChange={(checked) => setRedactPersons(checked === true)}
          onSelect={(event) => event.preventDefault()}
        >
          Masquer les personnes
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

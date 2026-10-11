"use client";

import { useId, useRef, useState } from "react";
import { FileUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Import d'un relevé CSV : bouton de sélection (clavier, lecteur d'écran) +
 * glisser-déposer. Rien ne part sur le réseau : le fichier est lu dans le
 * navigateur. État vide de la page tant qu'aucun fichier n'est importé.
 */
export default function ImportDropzone({
  onFile,
  pendingFilters = 0,
}: {
  onFile: (file: File) => void;
  /** Filtres déjà présents dans l'URL, appliqués après l'import. */
  pendingFilters?: number;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed bg-surface/40 px-6 py-10 text-center transition-ui",
        over ? "border-primary bg-primary/5 shadow-glow" : "border-border-strong",
      )}
    >
      <span className="mb-3 flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/12 text-primary">
        <FileUp aria-hidden className="size-5" />
      </span>
      <h2 id={`${id}-title`} className="font-display text-base font-semibold text-foreground">
        Importer un relevé de transactions
      </h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        Fichier CSV avec une ligne d&apos;en-tête. Colonne obligatoire : <code>montant</code> (ou{" "}
        <code>débit</code> / <code>crédit</code>). Colonnes exploitées si présentes : <code>date</code>,{" "}
        <code>contrepartie</code>, <code>libellé</code>, <code>iban</code>, <code>devise</code>,{" "}
        <code>pays</code>, <code>siren</code>, <code>statut</code>, <code>référence</code>.
      </p>
      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-describedby={`${id}-privacy`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <Button type="button" className="mt-5" onClick={() => input.current?.click()}>
        <FileUp aria-hidden /> Choisir un fichier CSV
      </Button>
      <p className="mt-2 text-xs text-subtle">ou déposez-le ici</p>
      <p id={`${id}-privacy`} className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3.5" />
        Analyse 100 % locale : le fichier ne quitte pas votre navigateur.
      </p>
      {pendingFilters > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {pendingFilters > 1
            ? `${pendingFilters} filtres enregistrés dans l'adresse de la page s'appliqueront après l'import.`
            : "1 filtre enregistré dans l'adresse de la page s'appliquera après l'import."}
        </p>
      ) : null}
    </div>
  );
}

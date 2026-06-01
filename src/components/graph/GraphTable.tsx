"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import EvidenceBadge from "./EvidenceBadge";
import {
  EDGE_LABELS,
  NODE_COLORS,
  NODE_LABELS,
} from "@/lib/graph/graph-types";
import type { CaseBundle, GraphDTO } from "@/lib/graph/graph-types";
import { useGraphStore } from "@/lib/store/graph-store";

/**
 * Vue table équivalente du graphe — alternative accessible aux lecteurs
 * d'écran et au clavier. Liste exhaustive des entités et liens du dossier,
 * synchronisée avec le store de sélection. WCAG 2.1 / 2.2 conforme :
 * - sémantique <table> native,
 * - rôles ARIA implicites,
 * - navigation au clavier (tabindex sur les lignes),
 * - texte alternatif aux signaux visuels (couleur + style).
 */
export default function GraphTable({
  dto,
  bundle,
}: {
  dto: GraphDTO;
  bundle: CaseBundle;
}) {
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectEdge = useGraphStore((s) => s.selectEdge);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectedEdge = useGraphStore((s) => s.selectedEdge);

  const labelOf = (id: string) =>
    bundle.entities.find((e) => e.id === id)?.label ??
    bundle.events.find((e) => e.id === id)?.title ??
    id;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background/95 backdrop-blur">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold">
          Vue accessible — équivalent table du graphe
        </h2>
        <p className="text-xs text-muted-foreground">
          Liste textuelle complète des entités et liens. Synchronisée avec le
          panneau de sélection. Pour revenir au graphe visuel, utilisez le
          bouton « Vue graphe » de la barre d&apos;outils ou la touche{" "}
          <kbd className="rounded border border-border px-1">T</kbd>.
        </p>
      </div>

      <Tabs defaultValue="entities" className="flex flex-1 flex-col">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="entities">
            Entités ({bundle.entities.length})
          </TabsTrigger>
          <TabsTrigger value="edges">Liens ({bundle.edges.length})</TabsTrigger>
          <TabsTrigger value="events">
            Événements ({bundle.events.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="flex-1 overflow-hidden p-4 pt-2">
          <ScrollArea className="h-full rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Niveau de preuve</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.entities.map((e) => (
                  <TableRow
                    key={e.id}
                    tabIndex={0}
                    aria-selected={selectedNode === e.id}
                    onClick={() => selectNode(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        selectNode(e.id);
                      }
                    }}
                    className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
                      selectedNode === e.id ? "bg-accent" : ""
                    }`}
                  >
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: NODE_COLORS[e.type] }}
                        />
                        {NODE_LABELS[e.type]}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{e.label}</TableCell>
                    <TableCell>
                      <EvidenceBadge level={e.evidenceLevel} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Object.entries(e.attributes ?? {})
                        .slice(0, 2)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="edges" className="flex-1 overflow-hidden p-4 pt-2">
          <ScrollArea className="h-full rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Poids</TableHead>
                  <TableHead>Niveau de preuve</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.edges.map((e) => (
                  <TableRow
                    key={e.id}
                    tabIndex={0}
                    aria-selected={selectedEdge === e.id}
                    onClick={() => selectEdge(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        selectEdge(e.id);
                      }
                    }}
                    className={`cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${
                      selectedEdge === e.id ? "bg-accent" : ""
                    }`}
                  >
                    <TableCell className="text-xs">
                      {EDGE_LABELS[e.type]}
                    </TableCell>
                    <TableCell className="font-medium">
                      {labelOf(e.source)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {labelOf(e.target)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.weight ?? "—"}
                    </TableCell>
                    <TableCell>
                      <EvidenceBadge level={e.evidenceLevel} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="events" className="flex-1 overflow-hidden p-4 pt-2">
          <ScrollArea className="h-full rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucun événement juridique.
                    </TableCell>
                  </TableRow>
                )}
                {bundle.events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs">
                      {ev.occurredOn ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">{ev.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ev.kind}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ev.source ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

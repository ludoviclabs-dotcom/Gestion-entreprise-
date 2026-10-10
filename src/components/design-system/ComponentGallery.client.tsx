"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Bell,
  Download,
  FolderOpen,
  LayoutGrid,
  List,
  Network,
  Plus,
  RefreshCw,
  Search,
  Table2,
} from "lucide-react";
import AppShell from "@/components/shell/AppShell";
import AppSidebar from "@/components/shell/AppSidebar";
import TopBar from "@/components/shell/TopBar";
import PageHeader from "@/components/shell/PageHeader";
import EmptyState from "@/components/empty/EmptyState";
import ErrorState from "@/components/empty/ErrorState";
import LoadingState from "@/components/empty/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Panel,
  PanelBody,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/card";
import { DataTable, type DataTableState } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { MetricChip } from "@/components/ui/metric-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidePanel } from "@/components/ui/side-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CASE_ORIGIN_TONE,
  CASE_STATUS_TONE,
  EVIDENCE_TONE,
  SEVERITY_TONE,
} from "@/lib/design/domain-tones";
import { TONE_LABELS, TONES } from "@/lib/design/tone";
import { MOTION_MS } from "@/lib/design/motion";
import { Section, Specimen } from "./Section";

const ROWS = [
  { id: "d1", name: "Holding Patrimoniale — démonstration", siren: "900 111 222", status: "ready", score: 72 },
  { id: "d2", name: "SCI Du Parc", siren: "799 220 118", status: "enriching", score: 48 },
  { id: "d3", name: "Martin Holding Ltd (correspondance)", siren: "—", status: "draft", score: 0 },
  { id: "d4", name: "Société Exemple SAS", siren: "812 444 901", status: "error", score: 91 },
] as const;

export default function ComponentGallery() {
  const reducedMotion = useReducedMotion();

  const [view, setView] = useState("liste");
  const [tableState, setTableState] = useState<DataTableState>("ready");
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [pressed, setPressed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [replay, setReplay] = useState(0);

  return (
    <div>
      {/* ───────────── Coque ───────────── */}
      <Section
        id="coque"
        title="Coque : AppShell · Sidebar · Topbar · PageHeader"
        description="Assemblée dans (app)/layout.tsx. Ici : la vraie coque, dans un cadre de 420 px. La sidebar apparaît dès le breakpoint md (768 px) ; en dessous, un tiroir s'ouvre depuis la Topbar."
      >
        <div className="overflow-hidden rounded-lg border border-border-strong">
          <AppShell
            className="h-[420px]"
            sidebar={<AppSidebar demoMode />}
            topbar={<TopBar demoMode />}
            canvas="grid"
          >
            <div className="space-y-5 p-6">
              <PageHeader
                eyebrow="Dossier · SIREN 900 111 222"
                title="Holding Patrimoniale"
                description="Cartographie de conformité — 7 entités, 9 liens."
                meta={
                  <>
                    <StatusBadge tone="success">Prêt</StatusBadge>
                    <StatusBadge tone="vigilance">À trier</StatusBadge>
                  </>
                }
                actions={
                  <>
                    <Button variant="outline" size="sm">
                      <Download /> Exporter
                    </Button>
                    <Button size="sm">
                      <Plus /> Nouveau dossier
                    </Button>
                  </>
                }
              />
              <div className="flex flex-wrap gap-2">
                <MetricChip label="Complexité" value={58} tone="vigilance" />
                <MetricChip label="Vigilance" value={72} tone="critical" />
                <MetricChip label="Qualité de preuve" value={64} tone="success" />
              </div>
            </div>
          </AppShell>
        </div>
      </Section>

      {/* ───────────── Panneaux ───────────── */}
      <Section
        id="panneaux"
        title="Panel / Card"
        description="`Card` est étendu (variants default · panel · raised · sunken, `interactive`) — pas de second composant. `Panel*` compose la variante dense : en-tête, corps, pied séparés par des filets."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <PanelHeader>
              <div>
                <PanelTitle>Répartition des signaux</PanelTitle>
                <PanelDescription>Famille × sévérité, 9 dossiers.</PanelDescription>
              </div>
              <IconButton label="Actualiser" icon={RefreshCw} size="sm" />
            </PanelHeader>
            <PanelBody className="text-sm text-muted-foreground">
              Corps du panneau — contenu dense, aligné sur la grille de 4 px.
            </PanelBody>
            <PanelFooter>
              <span>Source : fixtures anonymisées</span>
              <span className="tabular-nums">Mis à jour 10/10/2026</span>
            </PanelFooter>
          </Panel>

          <Card variant="raised">
            <CardHeader>
              <CardTitle>Surface surélevée</CardTitle>
              <CardDescription>variant=&quot;raised&quot; — contenu mis en avant.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Élévation moyenne et bordure appuyée.
            </CardContent>
          </Card>

          <Card variant="sunken">
            <CardHeader>
              <CardTitle>Puits</CardTitle>
              <CardDescription>variant=&quot;sunken&quot; — zones en creux, aperçus.</CardDescription>
            </CardHeader>
          </Card>

          <Card interactive tabIndex={0} className="gap-2 p-5">
            <p className="font-display text-sm font-semibold">Carte interactive</p>
            <p className="text-sm text-muted-foreground">
              Survol et focus : bordure d&apos;accent + halo. Aucun déplacement.
            </p>
          </Card>
        </div>
      </Section>

      {/* ───────────── Badges et métriques ───────────── */}
      <Section
        id="statuts"
        title="StatusBadge · MetricChip"
        description="Cinq teintes de risque strictes et constantes + l'accent (interaction, jamais un niveau de risque). Le libellé est toujours présent : la couleur ne porte jamais seule l'information."
      >
        <Specimen label="Teintes — soft (défaut)">
          {TONES.map((tone) => (
            <StatusBadge key={tone} tone={tone}>
              {TONE_LABELS[tone]}
            </StatusBadge>
          ))}
        </Specimen>
        <Specimen label="Teintes — outline">
          {TONES.map((tone) => (
            <StatusBadge key={tone} tone={tone} appearance="outline">
              {TONE_LABELS[tone]}
            </StatusBadge>
          ))}
        </Specimen>
        <Specimen label="Teintes — solid">
          {TONES.map((tone) => (
            <StatusBadge key={tone} tone={tone} appearance="solid" dot={false}>
              {TONE_LABELS[tone]}
            </StatusBadge>
          ))}
        </Specimen>
        <Specimen label="Pont domaine → teinte (statut, origine, sévérité, preuve)">
          <StatusBadge tone={CASE_STATUS_TONE.ready}>Prêt</StatusBadge>
          <StatusBadge tone={CASE_STATUS_TONE.enriching}>Enrichissement</StatusBadge>
          <StatusBadge tone={CASE_STATUS_TONE.error}>Erreur</StatusBadge>
          <StatusBadge tone={CASE_ORIGIN_TONE.fixture}>Démo</StatusBadge>
          <StatusBadge tone={SEVERITY_TONE.high}>Élevée</StatusBadge>
          <StatusBadge tone={SEVERITY_TONE.medium}>Modérée</StatusBadge>
          <StatusBadge tone={EVIDENCE_TONE.confirmed}>Confirmé</StatusBadge>
          <StatusBadge tone={EVIDENCE_TONE.inferred}>Inféré · à vérifier</StatusBadge>
        </Specimen>
        <Specimen label="MetricChip — tailles md / sm, teinte de la valeur">
          <MetricChip label="Complexité" value={58} unit="/100" tone="vigilance" />
          <MetricChip label="Vigilance" value={72} unit="/100" tone="critical" />
          <MetricChip label="Qualité de preuve" value={91} unit="/100" tone="success" />
          <MetricChip label="Entités" value={152} />
          <MetricChip label="Sources" value="3/16" size="sm" tone="info" />
          <MetricChip label="Vigilance" value="—" size="sm" tone="neutral" />
        </Specimen>
      </Section>

      {/* ───────────── Actions ───────────── */}
      <Section
        id="actions"
        title="Button · IconButton"
        description="Une seule action primaire par vue. Survol = fond / bordure / halo. IconButton étend Button : nom accessible obligatoire, infobulle au survol et au focus."
      >
        <Specimen label="Button — variantes">
          <Button>Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructif</Button>
          <Button variant="link">Lien</Button>
          <Button disabled>Désactivé</Button>
        </Specimen>
        <Specimen label="IconButton — tailles xs · sm · md · lg, avec infobulle">
          <IconButton label="Rechercher" icon={Search} size="xs" variant="outline" />
          <IconButton label="Notifications" icon={Bell} size="sm" variant="outline" />
          <IconButton label="Ouvrir le dossier" icon={FolderOpen} variant="outline" />
          <IconButton label="Afficher le graphe" icon={Network} size="lg" variant="outline" />
        </Specimen>
        <Specimen label="IconButton — état bascule (aria-pressed)">
          <IconButton
            label={pressed ? "Désactiver la grille" : "Activer la grille"}
            icon={Table2}
            variant={pressed ? "secondary" : "outline"}
            pressed={pressed}
            onClick={() => setPressed((v) => !v)}
          />
          <span className="text-sm text-muted-foreground">
            aria-pressed = {String(pressed)}
          </span>
        </Specimen>
      </Section>

      {/* ───────────── Navigation locale ───────────── */}
      <Section
        id="navigation"
        title="Tabs · SegmentedControl"
        description="Tabs : naviguer entre panneaux d'un même contenu. SegmentedControl : choisir une valeur (mode d'affichage, période) — sémantique radio, flèches du clavier, une valeur toujours active."
      >
        <Specimen label="Tabs — variant « line » (navigation de contenu)">
          <Tabs defaultValue="graphe" className="w-full max-w-xl">
            <TabsList variant="line" className="w-full justify-start border-b border-border">
              <TabsTrigger value="graphe">Graphe</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="risques">Risques</TabsTrigger>
            </TabsList>
            <TabsContent value="graphe" className="pt-3 text-sm text-muted-foreground">
              Vue graphe du dossier.
            </TabsContent>
            <TabsContent value="timeline" className="pt-3 text-sm text-muted-foreground">
              Chronologie juridique.
            </TabsContent>
            <TabsContent value="risques" className="pt-3 text-sm text-muted-foreground">
              Signaux de vigilance.
            </TabsContent>
          </Tabs>
        </Specimen>
        <Specimen label="Tabs — variant « default » (outils denses)">
          <Tabs defaultValue="entites">
            <TabsList>
              <TabsTrigger value="entites">Entités (7)</TabsTrigger>
              <TabsTrigger value="liens">Liens (9)</TabsTrigger>
              <TabsTrigger value="evenements">Événements (4)</TabsTrigger>
            </TabsList>
          </Tabs>
        </Specimen>
        <Specimen label="SegmentedControl — md et sm">
          <SegmentedControl
            label="Mode d'affichage"
            value={view}
            onValueChange={setView}
            options={[
              { value: "liste", label: "Liste", icon: List },
              { value: "carte", label: "Cartes", icon: LayoutGrid },
              { value: "table", label: "Table", icon: Table2 },
            ]}
          />
          <SegmentedControl
            label="Densité"
            size="sm"
            value={density}
            onValueChange={(v) => setDensity(v as "compact" | "comfortable")}
            options={[
              { value: "comfortable", label: "Aérée" },
              { value: "compact", label: "Compacte" },
            ]}
          />
          <span className="text-sm text-muted-foreground">
            Sélection : <span className="font-mono text-foreground">{view}</span> ·{" "}
            <span className="font-mono text-foreground">{density}</span>
          </span>
        </Specimen>
      </Section>

      {/* ───────────── Données ───────────── */}
      <Section
        id="donnees"
        title="DataTable (coque) et états"
        description="La coque fournit conteneur, barre d'outils, zone défilante (en-tête collant, densité), pied — et les trois états au même emplacement, sans saut de mise en page."
      >
        <Specimen label="État de la table">
          <SegmentedControl
            label="État de la table"
            size="sm"
            value={tableState}
            onValueChange={setTableState}
            options={[
              { value: "ready", label: "Prêt" },
              { value: "loading", label: "Chargement" },
              { value: "empty", label: "Vide" },
              { value: "error", label: "Erreur" },
            ]}
          />
        </Specimen>
        <DataTable
          label="Dossiers de démonstration"
          state={tableState}
          density={density}
          stickyHeader
          maxHeight="18rem"
          toolbar={
            <>
              <div className="relative max-w-xs flex-1">
                <Search
                  size={15}
                  aria-hidden
                  className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
                />
                <Input placeholder="Filtrer par nom ou SIREN…" className="pl-9" aria-label="Filtrer" />
              </div>
              <span className="ml-auto text-xs text-muted-foreground">{ROWS.length} dossiers</span>
            </>
          }
          footer={
            <>
              <span>Source : fixtures anonymisées</span>
              <span>Lignes 1–{ROWS.length}</span>
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Dossier</TableHead>
                <TableHead>SIREN</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Vigilance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{row.siren}</TableCell>
                  <TableCell>
                    <StatusBadge tone={CASE_STATUS_TONE[row.status]}>
                      {{ ready: "Prêt", enriching: "Enrichissement", draft: "Brouillon", error: "Erreur" }[row.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>

        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            icon={FolderOpen}
            title="Aucun dossier pour l'instant"
            description="Lancez un premier enrichissement à partir d'un SIREN."
            cta={{ label: "Créer un dossier", href: "/cases/new" }}
          />
          <div className="rounded-lg border border-border bg-surface">
            <LoadingState label="Chargement du dossier…" rows={3} />
          </div>
          <ErrorState
            title="Source indisponible"
            description="La source n'a pas répondu. Les autres données restent exploitables."
            tone="vigilance"
            action={
              <Button size="sm" variant="outline">
                <RefreshCw /> Réessayer
              </Button>
            }
          />
        </div>
      </Section>

      {/* ───────────── Surcouches ───────────── */}
      <Section
        id="surcouches"
        title="Tooltip · Dialog · SidePanel"
        description="Surcouches Radix : focus piégé en mode modal, retour du focus au déclencheur, fermeture par Échap. Essayez au clavier : Tab / Maj+Tab / Échap."
      >
        <Specimen label="Tooltip (survol et focus clavier)">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Survolez-moi</Button>
              </TooltipTrigger>
              <TooltipContent>Infobulle : texte bref, jamais d&apos;action.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Specimen>

        <Specimen label="Dialog (modal)">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Ouvrir un dialogue</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archiver ce dossier ?</DialogTitle>
                <DialogDescription>
                  Le dossier reste consultable dans le journal de preuve. Cette action est
                  réversible.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton>
                <Button>Archiver</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Specimen>

        <Specimen label="SidePanel — modal (voile + focus piégé) et non modal (inspection)">
          <SidePanel
            trigger={<Button variant="outline">Panneau modal</Button>}
            title="Inspecteur de preuve"
            description="Source officielle · empreinte SHA-256"
            footer={<Button className="w-full">Verser au dossier</Button>}
          >
            <p className="text-sm text-muted-foreground">
              Corps défilant. Le focus reste dans le panneau ; Échap ou le bouton le ferme et
              rend le focus au déclencheur.
            </p>
          </SidePanel>

          <Button variant="outline" onClick={() => setPanelOpen(true)}>
            Panneau non modal
          </Button>
          <SidePanel
            modal={false}
            open={panelOpen}
            onOpenChange={setPanelOpen}
            size="sm"
            title="HOLDING PATRIMONIALE SAS"
            description="Société · confirmé"
          >
            <p className="text-sm text-muted-foreground">
              Panneau d&apos;inspection : pas de voile, la page reste utilisable. Échap ferme.
            </p>
          </SidePanel>
        </Specimen>
      </Section>

      {/* ───────────── Motion ───────────── */}
      <Section
        id="motion"
        title="Motion"
        description="Fonctionnelle et courte. Les états changent par couleur / bordure / halo ; seuls les panneaux se déplacent (12 px) à l'entrée. Rien ne boucle sur un contenu opérationnel."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Durées</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-1.5 text-sm">
              {(
                [
                  ["fast", "survol, focus, couleur"],
                  ["base", "changement d'état, infobulle, page"],
                  ["slow", "entrée d'un panneau / dialogue"],
                  ["exit", "sortie (toujours plus courte)"],
                ] as const
              ).map(([key, use]) => (
                <p key={key} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{use}</span>
                  <span className="font-mono text-foreground tabular-nums">{MOTION_MS[key]} ms</span>
                </p>
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Entrée de panneau</PanelTitle>
              <Button size="xs" variant="outline" onClick={() => setReplay((n) => n + 1)}>
                Rejouer
              </Button>
            </PanelHeader>
            <PanelBody className="flex h-24 items-center justify-center overflow-hidden">
              <div
                key={replay}
                className="motion-from-right motion-enter rounded-md border border-border-strong bg-surface-3 px-4 py-3 text-sm shadow-md"
              >
                Translation 12 px + opacité + ressort doux
              </div>
            </PanelBody>
            <PanelFooter>
              <span>
                Mouvement réduit : {reducedMotion ? "demandé — aucune transition" : "non demandé"}
              </span>
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Survol</PanelTitle>
            </PanelHeader>
            <PanelBody className="flex h-24 items-center justify-center">
              <Card
                interactive
                tabIndex={0}
                className="gap-0 px-4 py-3 text-sm"
              >
                Bordure + halo, sans mouvement
              </Card>
            </PanelBody>
          </Panel>
        </div>
      </Section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { Download, FileUp, ListFilter, SearchX, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { MetricChip } from "@/components/ui/metric-chip";
import { Reveal } from "@/components/ui/reveal";
import { SidePanel } from "@/components/ui/side-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyState from "@/components/empty/EmptyState";
import ErrorState from "@/components/empty/ErrorState";
import LoadingState from "@/components/empty/LoadingState";
import PageHeader from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";
import { formatDateFr } from "@/lib/format-date";
import { ingestRows, type IngestResult } from "@/lib/transactions/ingest";
import {
  RISK_LABELS,
  SIGNAL_KINDS,
  TRIAGE_LABELS,
  TRIAGE_STATUSES,
  activeFilterCount,
  countryOf,
  filtersFromParams,
  filtersToParams,
  matchesFilters,
  sortTransactions,
  summarize,
  triageTransactions,
  type SignalKind,
  type Sort,
  type SortKey,
  type TriageStatus,
  type TxFilters,
} from "@/lib/transactions/triage";
import TransactionFilters, { type FilterAvailability } from "./TransactionFilters.client";
import { TransactionsList, TransactionsTable } from "./TransactionsTable.client";
import TransactionDetail, { type LinkedCase } from "./TransactionDetail.client";
import PopulationPanel from "./PopulationPanel";
import ImportDropzone from "./ImportDropzone.client";
import { formatAmount, formatTxDate } from "./format";

type Phase = "idle" | "loading" | "ready" | "error";
type FileMeta = { name: string; size: number; lastModified: number };

const PAGE = 100;

const storageKey = (f: FileMeta) => `kyb:transactions:triage:${f.name}:${f.size}:${f.lastModified}`;

/** Statuts de triage de CE fichier dans cet onglet (sessionStorage) — jamais les données. */
function loadStatuses(f: FileMeta): Record<string, TriageStatus> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey(f)) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string" && (TRIAGE_STATUSES as string[]).includes(v),
      ),
    ) as Record<string, TriageStatus>;
  } catch {
    return {};
  }
}

/**
 * Espace de triage des transactions : en-tête (volume, période, contexte des
 * filtres, action de revue), bandeau de filtres (conservés dans l'URL),
 * tableau dense (liste de cartes sous lg), panneau de détail non modal,
 * analyses de population. Tout est calculé dans le navigateur à partir du
 * fichier importé : aucune donnée n'est ajoutée ni envoyée.
 */
export default function TransactionsWorkspace({ cases }: { cases: LinkedCase[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters, sort } = useMemo(
    () => filtersFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<{ title: string; description: string } | null>(null);
  const [file, setFile] = useState<FileMeta | null>(null);
  const [data, setData] = useState<IngestResult | null>(null);
  const [statuses, setStatuses] = useState<Record<string, TriageStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("transactions");
  const [limit, setLimit] = useState(PAGE);
  const fileInput = useRef<HTMLInputElement>(null);

  const triage = useMemo(() => (data ? triageTransactions(data.transactions) : null), [data]);
  const caseBySiren = useMemo(() => new Map(cases.map((c) => [c.rootSiren, c])), [cases]);
  const statusOf = useCallback((id: string) => statuses[id] ?? "a_trier", [statuses]);

  useEffect(() => {
    if (!file) return;
    try {
      sessionStorage.setItem(storageKey(file), JSON.stringify(statuses));
    } catch {
      /* stockage indisponible (navigation privée) : le triage reste en mémoire */
    }
  }, [file, statuses]);

  const navigate = useCallback(
    (next: TxFilters, nextSort: Sort = sort) => {
      const qs = filtersToParams(next, nextSort).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setLimit(PAGE);
    },
    [pathname, router, sort],
  );

  function onFile(f: File) {
    setPhase("loading");
    setFailure(null);
    setSelectedId(null);
    setLimit(PAGE);
    Papa.parse<Record<string, unknown>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const result = ingestRows(res.data);
        if (result.transactions.length === 0) {
          setData(null);
          setFile(null);
          setFailure({
            title: "Aucune transaction exploitable",
            description:
              "Aucune ligne ne porte de montant lisible. Vérifiez la ligne d'en-tête : une colonne « montant » (ou « débit » / « crédit ») est obligatoire.",
          });
          setPhase("error");
          return;
        }
        const meta = { name: f.name, size: f.size, lastModified: f.lastModified };
        setFile(meta);
        setData(result);
        setStatuses(loadStatuses(meta));
        setTab("transactions");
        setPhase("ready");
      },
      error: () => {
        setData(null);
        setFile(null);
        setFailure({
          title: "Fichier illisible",
          description: "Le fichier n'a pas pu être lu comme un CSV. Exportez le relevé au format CSV (séparateur virgule ou point-virgule) et réessayez.",
        });
        setPhase("error");
      },
    });
  }

  const linked = useCallback(
    (siren?: string) => (siren ? caseBySiren.get(siren) : undefined),
    [caseBySiren],
  );

  const visible = useMemo(() => {
    if (!triage) return [];
    const kept = triage.items.filter((t) =>
      matchesFilters(t, filters, { status: statusOf(t.id), linked: Boolean(linked(t.siren)) }),
    );
    return sortTransactions(kept, sort);
  }, [triage, filters, sort, statusOf, linked]);

  const summary = useMemo(() => (triage ? summarize(triage.items) : null), [triage]);

  const availability = useMemo<FilterAvailability | null>(() => {
    if (!triage || !data) return null;
    const items = triage.items;
    const currencies = [...new Set(items.map((t) => t.currency).filter((c): c is string => Boolean(c)))].sort();
    const countries = [...new Set(items.map(countryOf).filter((c): c is string => Boolean(c)))].sort();
    const signalCounts = Object.fromEntries(
      SIGNAL_KINDS.map((k) => [k, items.filter((t) => t.signals.some((s) => s.kind === k)).length]),
    ) as Record<SignalKind, number>;
    return {
      dates: items.some((t) => t.date),
      counterparty: data.columns.counterparty,
      currencies,
      hasUnknownCurrency: items.some((t) => !t.currency),
      countries,
      countryFromIban: !data.columns.country,
      siren: items.some((t) => t.siren),
      signalCounts: { ...signalCounts, aucun: items.filter((t) => t.signals.length === 0).length },
    };
  }, [triage, data]);

  const selected = triage?.items.find((t) => t.id === selectedId) ?? null;
  const lineOf = useCallback(
    (id: string) => triage?.items.find((t) => t.id === id)?.line,
    [triage],
  );

  const closePanel = () => {
    const id = selectedId;
    setSelectedId(null);
    // Rend le focus à la ligne d'origine (le panneau non modal n'a pas de déclencheur).
    requestAnimationFrame(() => {
      const targets = document.querySelectorAll<HTMLElement>(`[data-tx-open="${id}"]`);
      [...targets].find((el) => el.offsetParent !== null)?.focus();
    });
  };

  const onSort = (key: SortKey) =>
    navigate(filters, {
      key,
      dir: sort.key === key && sort.dir === "desc" ? "asc" : sort.key === key ? "desc" : key === "ligne" ? "asc" : "desc",
    });

  const filterSignal = (kind: SignalKind) => {
    setTab("transactions");
    navigate({ signal: kind });
  };

  /** Action de revue : transactions signalées, les plus prioritaires d'abord, la première ouverte. */
  const startReview = () => {
    if (!triage) return;
    const next: TxFilters = { risk: "signalee" };
    const nextSort: Sort = { key: "risque", dir: "desc" };
    navigate(next, nextSort);
    setTab("transactions");
    const first = sortTransactions(
      triage.items.filter((t) => t.signals.length > 0),
      nextSort,
    )[0];
    if (first) setSelectedId(first.id);
  };

  const exportView = () => {
    if (!file) return;
    const rows = visible.map((t) => ({
      ligne: t.line,
      ...t.raw,
      signaux: t.signals.map((s) => s.label).join(" ; "),
      motifs: t.signals.map((s) => s.motif).join(" | "),
      vigilance: RISK_LABELS[t.risk],
      statut_triage: TRIAGE_LABELS[statusOf(t.id)],
    }));
    const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name.replace(/\.csv$/i, "")}-triage.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const active = activeFilterCount(filters);
  const ready = phase === "ready" && triage && summary && availability && file;

  return (
    <div
      className={cn(
        "mx-auto max-w-[var(--layout-page-max)] space-y-5 px-4 py-6 sm:px-6 lg:py-8",
        selected && "xl:mr-[var(--layout-panel-width)]",
      )}
    >
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <Reveal index={0}>
        <PageHeader
          eyebrow="Analyse transactionnelle · locale"
          title="Transactions"
          description="Triez et investiguez un relevé importé : chaque signal est expliqué, relié à sa source et, quand le SIREN le permet, au dossier de la contrepartie. Signaux statistiques, jamais une conclusion."
          meta={
            ready ? (
              <>
                <MetricChip label="Volume" value={summary.count} unit={` transaction${summary.count > 1 ? "s" : ""}`} />
                <MetricChip
                  label="Période"
                  value={
                    summary.period
                      ? summary.period.from === summary.period.to
                        ? formatDateFr(summary.period.from)
                        : `${formatDateFr(summary.period.from)} → ${formatDateFr(summary.period.to)}`
                      : "dates non lues"
                  }
                />
                {summary.volumes.map((v) => (
                  <MetricChip
                    key={v.currency ?? "inconnue"}
                    label={v.currency ? `Flux ${v.currency}` : "Flux (devise non précisée)"}
                    value={`${formatAmount(-v.debit)} / ${formatAmount(v.credit)}`}
                    title="Débits / crédits — jamais additionnés entre devises"
                  />
                ))}
                <MetricChip
                  label="Signalées"
                  value={summary.signaled}
                  tone={summary.signaled > 0 ? "vigilance" : undefined}
                />
                {active > 0 ? (
                  <StatusBadge tone="accent" icon={ListFilter}>
                    Vue filtrée : {visible.length} sur {summary.count}
                  </StatusBadge>
                ) : null}
                {summary.undated > 0 ? (
                  <StatusBadge tone="neutral" appearance="outline">
                    {summary.undated} sans date lisible
                  </StatusBadge>
                ) : null}
                {data && data.skipped > 0 ? (
                  <StatusBadge tone="vigilance" appearance="outline">
                    {data.skipped} ligne{data.skipped > 1 ? "s" : ""} ignorée{data.skipped > 1 ? "s" : ""} : montant illisible
                  </StatusBadge>
                ) : null}
              </>
            ) : undefined
          }
          actions={
            <>
              <Button type="button" onClick={startReview} disabled={!ready || summary.signaled === 0}>
                <ShieldAlert aria-hidden />
                Revoir les signalées{ready ? ` (${summary.signaled})` : ""}
              </Button>
              <Button type="button" variant="outline" onClick={exportView} disabled={!ready || visible.length === 0}>
                <Download aria-hidden /> Exporter la vue
              </Button>
              {phase !== "idle" ? (
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                  <FileUp aria-hidden /> Autre fichier
                </Button>
              ) : null}
            </>
          }
        />
      </Reveal>

      {phase === "idle" ? (
        <Reveal index={1}>
          <ImportDropzone onFile={onFile} pendingFilters={active} />
        </Reveal>
      ) : phase === "error" && failure ? (
        <Reveal index={1}>
          <ErrorState
            title={failure.title}
            description={failure.description}
            action={
              <Button type="button" onClick={() => fileInput.current?.click()}>
                <FileUp aria-hidden /> Choisir un autre fichier
              </Button>
            }
          />
        </Reveal>
      ) : phase === "loading" || !ready ? (
        <DataTable
          label="Transactions importées"
          state="loading"
          loading={<LoadingState variant="rows" rows={6} label="Lecture et analyse du fichier…" />}
        />
      ) : (
        <>
          <Reveal index={1}>
            <TransactionFilters
              filters={filters}
              onChange={(next) => navigate(next)}
              availability={availability}
              shown={visible.length}
              total={summary.count}
            />
          </Reveal>

          <Reveal index={2}>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList variant="line" className="w-full justify-start border-b border-border">
                <TabsTrigger value="transactions" className="flex-none px-4">
                  Transactions <span className="text-subtle tabular-nums">({visible.length})</span>
                </TabsTrigger>
                <TabsTrigger value="population" className="flex-none px-4">Analyse de population</TabsTrigger>
              </TabsList>

              <TabsContent value="transactions" className="pt-3">
                <DataTable
                  label="Transactions importées"
                  state={visible.length === 0 ? "empty" : "ready"}
                  density="compact"
                  stickyHeader
                  maxHeight="min(72vh, 52rem)"
                  empty={
                    <EmptyState
                      variant="inline"
                      icon={SearchX}
                      title="Aucune transaction ne correspond aux filtres"
                      description={`${summary.count} transaction${summary.count > 1 ? "s" : ""} dans le fichier.`}
                      action={
                        <Button type="button" size="sm" variant="outline" onClick={() => navigate({})}>
                          Réinitialiser les filtres
                        </Button>
                      }
                    />
                  }
                  footer={
                    <>
                      <span className="tabular-nums">
                        {Math.min(limit, visible.length)} affichée{visible.length > 1 ? "s" : ""} sur {visible.length} ·
                        source : {file.name}
                      </span>
                      {visible.length > limit ? (
                        <Button type="button" size="xs" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                          Afficher {Math.min(PAGE, visible.length - limit)} de plus
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  <div className="hidden lg:block">
                    <TransactionsTable
                      items={visible.slice(0, limit)}
                      statusOf={statusOf}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      sort={sort}
                      onSort={onSort}
                    />
                  </div>
                  <div className="lg:hidden">
                    <TransactionsList
                      items={visible.slice(0, limit)}
                      statusOf={statusOf}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                    />
                  </div>
                </DataTable>
              </TabsContent>

              <TabsContent value="population" className="pt-3">
                <PopulationPanel result={triage} onFilterSignal={filterSignal} />
              </TabsContent>
            </Tabs>
          </Reveal>

          <SidePanel
            open={Boolean(selected)}
            onOpenChange={(open) => {
              if (!open) closePanel();
            }}
            modal={false}
            title={selected?.counterparty ?? "Contrepartie non renseignée"}
            description={selected ? `Ligne ${selected.line} · ${formatTxDate(selected)}` : undefined}
          >
            {selected ? (
              <TransactionDetail
                t={selected}
                status={statusOf(selected.id)}
                onStatusChange={(s) => setStatuses((prev) => ({ ...prev, [selected.id]: s }))}
                linkedCase={linked(selected.siren)}
                fileName={file.name}
                lineOf={lineOf}
                onSelect={setSelectedId}
                onFilterSignal={filterSignal}
              />
            ) : null}
          </SidePanel>
        </>
      )}
    </div>
  );
}

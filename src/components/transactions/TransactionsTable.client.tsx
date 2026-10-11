"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  RISK_LABELS,
  RISK_TONE,
  TRIAGE_LABELS,
  TRIAGE_TONE,
  type Sort,
  type SortKey,
  type TriageStatus,
  type TriagedTransaction,
} from "@/lib/transactions/triage";
import { directionLabel, formatAmount, formatTxDate, SIGNAL_TONE } from "./format";

type RowProps = {
  items: TriagedTransaction[];
  statusOf: (id: string) => TriageStatus;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const MAX_BADGES = 2;

function Signals({ t }: { t: TriagedTransaction }) {
  if (t.signals.length === 0) return <span className="text-xs text-subtle">—</span>;
  const shown = t.signals.slice(0, MAX_BADGES);
  const rest = t.signals.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((s, i) => (
        <StatusBadge key={`${s.kind}-${i}`} tone={SIGNAL_TONE[s.kind]} appearance="outline">
          {s.label}
        </StatusBadge>
      ))}
      {rest > 0 ? (
        <StatusBadge tone="neutral" appearance="outline" dot={false}>
          +{rest}
        </StatusBadge>
      ) : null}
    </span>
  );
}

function Amount({ t, align = "right" }: { t: TriagedTransaction; align?: "left" | "right" }) {
  return (
    <span className={cn("flex flex-col", align === "right" ? "items-end" : "items-start")}>
      <span className="font-medium text-foreground tabular-nums">{formatAmount(t.amount, t.currency)}</span>
      <span className="text-micro text-subtle">{directionLabel(t.amount)}</span>
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: ReactNode;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm uppercase transition-ui hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

/**
 * Tableau (≥ lg) : colonnes stables — date · contrepartie · montant · signaux ·
 * vigilance et statut. Ligne entière cliquable ; au clavier, le nom de la
 * contrepartie est le bouton d'ouverture. Ligne sélectionnée : fond d'accent +
 * liseré cyan, `aria-selected`.
 */
export function TransactionsTable({
  sort,
  onSort,
  ...rows
}: RowProps & { sort: Sort; onSort: (key: SortKey) => void }) {
  return (
    <Table className="min-w-[46rem] table-fixed">
      <colgroup>
        <col className="w-[6.5rem]" />
        <col />
        <col className="w-[9.5rem]" />
        <col className="w-[11rem]" />
        <col className="w-[10.5rem]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHeader label="Date" sortKey="date" sort={sort} onSort={onSort} />
          <TableHead>Contrepartie</TableHead>
          <SortHeader label="Montant" sortKey="montant" sort={sort} onSort={onSort} align="right" />
          <TableHead>Signaux</TableHead>
          <SortHeader label="Vigilance · statut" sortKey="risque" sort={sort} onSort={onSort} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.items.map((t) => {
          const selected = rows.selectedId === t.id;
          const status = rows.statusOf(t.id);
          return (
            <TableRow
              key={t.id}
              aria-selected={selected}
              data-state={selected ? "selected" : undefined}
              onClick={() => rows.onSelect(t.id)}
              className="cursor-pointer align-top data-[state=selected]:bg-primary/10"
            >
              <TableCell className="relative text-xs text-muted-foreground tabular-nums">
                {selected ? (
                  <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
                ) : null}
                <span className={cn(!t.date && t.dateRaw && "italic")}>{formatTxDate(t)}</span>
              </TableCell>
              <TableCell className="min-w-0">
                <button
                  type="button"
                  data-tx-open={t.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    rows.onSelect(t.id);
                  }}
                  aria-label={`Ouvrir la transaction ligne ${t.line} : ${t.counterparty ?? "contrepartie non renseignée"}, ${formatAmount(t.amount, t.currency)}`}
                  className="block w-full min-w-0 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn("block truncate font-medium", t.counterparty ? "text-foreground" : "text-subtle italic")}>
                    {t.counterparty ?? "Contrepartie non renseignée"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Ligne {t.line}
                    {t.label && t.label !== t.counterparty ? ` · ${t.label}` : ""}
                  </span>
                </button>
              </TableCell>
              <TableCell className="text-right">
                <Amount t={t} />
              </TableCell>
              <TableCell>
                <Signals t={t} />
              </TableCell>
              <TableCell>
                <span className="flex flex-col items-start gap-1">
                  <StatusBadge tone={RISK_TONE[t.risk]}>{RISK_LABELS[t.risk]}</StatusBadge>
                  <StatusBadge tone={TRIAGE_TONE[status]} appearance="outline">
                    {TRIAGE_LABELS[status]}
                  </StatusBadge>
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Liste de consultation (< lg) : une carte par transaction — contrepartie et
 * montant d'abord, puis date, vigilance, statut, signaux. Aucune table à faire
 * défiler horizontalement.
 */
export function TransactionsList({ items, statusOf, selectedId, onSelect }: RowProps) {
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((t) => {
        const selected = selectedId === t.id;
        const status = statusOf(t.id);
        return (
          <li key={t.id}>
            <button
              type="button"
              data-tx-open={t.id}
              onClick={() => onSelect(t.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "relative flex w-full flex-col gap-2 px-3 py-3 text-left transition-ui hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-muted",
                selected && "bg-primary/10",
              )}
            >
              {selected ? (
                <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
              ) : null}
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className={cn("block truncate font-medium", t.counterparty ? "text-foreground" : "text-subtle italic")}>
                    {t.counterparty ?? "Contrepartie non renseignée"}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatTxDate(t)} · ligne {t.line}
                  </span>
                </span>
                <Amount t={t} />
              </span>
              <span className="flex flex-wrap items-center gap-1">
                <StatusBadge tone={RISK_TONE[t.risk]}>{RISK_LABELS[t.risk]}</StatusBadge>
                <StatusBadge tone={TRIAGE_TONE[status]} appearance="outline">
                  {TRIAGE_LABELS[status]}
                </StatusBadge>
                {t.signals.map((s, i) => (
                  <StatusBadge key={`${s.kind}-${i}`} tone={SIGNAL_TONE[s.kind]} appearance="outline">
                    {s.label}
                  </StatusBadge>
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

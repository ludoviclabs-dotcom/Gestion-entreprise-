"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  RISK_LABELS,
  SIGNAL_KINDS,
  SIGNAL_LABELS,
  TRIAGE_LABELS,
  TRIAGE_STATUSES,
  UNKNOWN_CURRENCY,
  activeFilterCount,
  clean,
  type SignalKind,
  type TxFilters,
} from "@/lib/transactions/triage";
import { formatDateFr } from "@/lib/format-date";

/** Ce que le fichier permet de filtrer — un filtre sans donnée est désactivé, motif écrit. */
export type FilterAvailability = {
  dates: boolean;
  counterparty: boolean;
  currencies: string[];
  hasUnknownCurrency: boolean;
  countries: string[];
  /** Le pays vient uniquement de l'IBAN (pas de colonne pays). */
  countryFromIban: boolean;
  siren: boolean;
  signalCounts: Record<SignalKind | "aucun", number>;
};

const RISK_OPTIONS = [
  ["signalee", "Signalées (au moins 1 signal)"],
  ["renforcee", RISK_LABELS.renforcee],
  ["vigilance", RISK_LABELS.vigilance],
  ["aucun", RISK_LABELS.aucun],
] as const;

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-micro text-subtle">{hint}</p> : null}
    </div>
  );
}

/** Valeur saisie au clavier, validée après une courte pause (pas une URL par frappe). */
function useDebounced<T>(value: T, onCommit: (v: T) => void, delay = 300) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onCommit(draft), delay);
    return () => clearTimeout(t);
  }, [draft, value, onCommit, delay]);
  return [draft, setDraft] as const;
}

/** Libellés lisibles des filtres actifs (contexte de l'en-tête, puces amovibles). */
export function describeFilters(filters: TxFilters): { key: keyof TxFilters; label: string }[] {
  const f = clean(filters);
  const out: { key: keyof TxFilters; label: string }[] = [];
  if (f.from) out.push({ key: "from", label: `Depuis le ${formatDateFr(f.from)}` });
  if (f.to) out.push({ key: "to", label: `Jusqu'au ${formatDateFr(f.to)}` });
  if (f.status) out.push({ key: "status", label: `Statut : ${TRIAGE_LABELS[f.status]}` });
  if (f.risk) out.push({ key: "risk", label: `Vigilance : ${RISK_OPTIONS.find(([v]) => v === f.risk)?.[1]}` });
  if (f.signal) out.push({ key: "signal", label: `Signal : ${f.signal === "aucun" ? "aucun" : SIGNAL_LABELS[f.signal]}` });
  if (f.min !== undefined) out.push({ key: "min", label: `Montant ≥ ${f.min.toLocaleString("fr-FR")}` });
  if (f.max !== undefined) out.push({ key: "max", label: `Montant ≤ ${f.max.toLocaleString("fr-FR")}` });
  if (f.currency) out.push({ key: "currency", label: `Devise : ${f.currency === UNKNOWN_CURRENCY ? "non précisée" : f.currency}` });
  if (f.q) out.push({ key: "q", label: `Contrepartie : « ${f.q} »` });
  if (f.country) out.push({ key: "country", label: `Pays : ${f.country}` });
  if (f.linked) out.push({ key: "linked", label: f.linked === "oui" ? "Avec dossier lié" : "Sans dossier lié" });
  return out;
}

/**
 * Bandeau de filtres : deux rangées ordonnées — triage (période, statut,
 * vigilance, signal, dossier) puis données (montant, devise, pays,
 * contrepartie). Sous `md`, repliable derrière « Filtres ». Chaque filtre que
 * le fichier ne peut pas alimenter est désactivé, avec son motif.
 */
export default function TransactionFilters({
  filters,
  onChange,
  availability,
  shown,
  total,
}: {
  filters: TxFilters;
  onChange: (next: TxFilters) => void;
  availability: FilterAvailability;
  shown: number;
  total: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<TxFilters>) => onChange(clean({ ...filters, ...patch }));
  const active = activeFilterCount(filters);
  const chips = describeFilters(filters);

  const [q, setQ] = useDebounced(filters.q ?? "", (v) => set({ q: v || undefined }));
  const [min, setMin] = useDebounced(filters.min?.toString() ?? "", (v) =>
    set({ min: v === "" ? undefined : Math.max(0, Number(v)) || 0 }),
  );
  const [max, setMax] = useDebounced(filters.max?.toString() ?? "", (v) =>
    set({ max: v === "" ? undefined : Math.max(0, Number(v)) || 0 }),
  );

  const countryLabel = availability.countryFromIban ? "Pays (de l'IBAN)" : "Pays";

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal aria-hidden className="size-4 text-subtle" />
          Filtres
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {shown} sur {total} transaction{total > 1 ? "s" : ""}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {active > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-expanded={open}
            aria-controls={`${id}-fields`}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Masquer" : "Afficher"}
            {active > 0 ? ` · ${active} actif${active > 1 ? "s" : ""}` : ""}
            <ChevronDown aria-hidden className={cn("transition-ui", open && "rotate-180")} />
          </Button>
        </div>
      </div>

      <div
        id={`${id}-fields`}
        className={cn(
          "grid-cols-2 gap-x-3 gap-y-3 border-t border-border px-3 py-3 sm:grid-cols-3 lg:grid-cols-6",
          open ? "grid" : "hidden md:grid",
        )}
      >
        {/* Rangée 1 — triage */}
        <Field
          label="Période"
          className="col-span-2"
          hint={availability.dates ? undefined : "Aucune date lisible dans le fichier."}
        >
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              aria-label="Du"
              className="h-8"
              disabled={!availability.dates}
              value={filters.from ?? ""}
              max={filters.to}
              onChange={(e) => set({ from: e.target.value || undefined })}
            />
            <span aria-hidden className="text-subtle">→</span>
            <Input
              type="date"
              aria-label="Au"
              className="h-8"
              disabled={!availability.dates}
              value={filters.to ?? ""}
              min={filters.from}
              onChange={(e) => set({ to: e.target.value || undefined })}
            />
          </div>
        </Field>
        <Field label="Statut de triage" htmlFor={`${id}-status`}>
          <NativeSelect
            id={`${id}-status`}
            size="sm"
            value={filters.status ?? ""}
            onChange={(e) => set({ status: (e.target.value || undefined) as TxFilters["status"] })}
          >
            <option value="">Tous</option>
            {TRIAGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TRIAGE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vigilance" htmlFor={`${id}-risk`}>
          <NativeSelect
            id={`${id}-risk`}
            size="sm"
            value={filters.risk ?? ""}
            onChange={(e) => set({ risk: (e.target.value || undefined) as TxFilters["risk"] })}
          >
            <option value="">Toutes</option>
            {RISK_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Signal" htmlFor={`${id}-signal`}>
          <NativeSelect
            id={`${id}-signal`}
            size="sm"
            value={filters.signal ?? ""}
            onChange={(e) => set({ signal: (e.target.value || undefined) as TxFilters["signal"] })}
          >
            <option value="">Tous</option>
            {SIGNAL_KINDS.map((k) => (
              <option key={k} value={k} disabled={availability.signalCounts[k] === 0 && filters.signal !== k}>
                {SIGNAL_LABELS[k]} ({availability.signalCounts[k]})
              </option>
            ))}
            <option value="aucun">Sans signal ({availability.signalCounts.aucun})</option>
          </NativeSelect>
        </Field>
        <Field
          label="Dossier lié"
          htmlFor={`${id}-linked`}
          hint={availability.siren ? undefined : "Colonne SIREN absente : rapprochement impossible."}
        >
          <NativeSelect
            id={`${id}-linked`}
            size="sm"
            disabled={!availability.siren}
            value={filters.linked ?? ""}
            onChange={(e) => set({ linked: (e.target.value || undefined) as TxFilters["linked"] })}
          >
            <option value="">{availability.siren ? "Tous" : "Non disponible"}</option>
            <option value="oui">Avec dossier KYB Graph</option>
            <option value="non">Sans dossier</option>
          </NativeSelect>
        </Field>

        {/* Rangée 2 — données */}
        <Field label="Montant (valeur absolue)" className="col-span-2">
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-label="Montant minimum"
              placeholder="Min"
              className="h-8"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
            <span aria-hidden className="text-subtle">→</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-label="Montant maximum"
              placeholder="Max"
              className="h-8"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </Field>
        <Field
          label="Devise"
          htmlFor={`${id}-currency`}
          hint={
            availability.currencies.length === 0 ? "Aucune devise dans le fichier." : undefined
          }
        >
          <NativeSelect
            id={`${id}-currency`}
            size="sm"
            disabled={availability.currencies.length === 0}
            value={filters.currency ?? ""}
            onChange={(e) => set({ currency: e.target.value || undefined })}
          >
            <option value="">{availability.currencies.length === 0 ? "Non disponible" : "Toutes"}</option>
            {availability.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {availability.hasUnknownCurrency && availability.currencies.length > 0 ? (
              <option value={UNKNOWN_CURRENCY}>Non précisée</option>
            ) : null}
          </NativeSelect>
        </Field>
        <Field
          label={countryLabel}
          htmlFor={`${id}-country`}
          hint={availability.countries.length === 0 ? "Ni colonne pays ni IBAN valide." : undefined}
        >
          <NativeSelect
            id={`${id}-country`}
            size="sm"
            disabled={availability.countries.length === 0}
            value={filters.country ?? ""}
            onChange={(e) => set({ country: e.target.value || undefined })}
          >
            <option value="">{availability.countries.length === 0 ? "Non disponible" : "Tous"}</option>
            {availability.countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Contrepartie ou libellé"
          htmlFor={`${id}-q`}
          className="col-span-2"
          hint={availability.counterparty ? undefined : "Colonne contrepartie absente."}
        >
          <Input
            id={`${id}-q`}
            type="search"
            className="h-8"
            placeholder={availability.counterparty ? "Nom, libellé…" : "Non disponible"}
            disabled={!availability.counterparty}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">Filtres actifs :</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => set({ [chip.key]: undefined })}
              aria-label={`Retirer le filtre ${chip.label}`}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-xs text-foreground transition-ui hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {chip.label}
              <X aria-hidden className="size-3 text-subtle" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, FolderOpen, Network, ShieldAlert } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_STYLES } from "@/lib/design/tone";
import {
  RISK_LABELS,
  RISK_RULE,
  RISK_TONE,
  TRIAGE_LABELS,
  TRIAGE_STATUSES,
  countryOf,
  type SignalKind,
  type TriageStatus,
  type TriagedTransaction,
} from "@/lib/transactions/triage";
import { directionLabel, formatAmount, formatTxDate, SIGNAL_TONE } from "./format";

export type LinkedCase = { id: string; title: string; rootSiren: string };

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Network; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-1.5 text-eyebrow">
        {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

const missing = <span className="text-subtle">Non fourni par le fichier</span>;

/**
 * Détail d'une transaction : montant, signaux et MOTIFS, statut de triage,
 * contrepartie (entité), dossier KYB Graph rapproché par SIREN, source
 * (fichier + ligne + valeurs brutes). Chaque lien dit où il mène.
 */
export default function TransactionDetail({
  t,
  status,
  onStatusChange,
  linkedCase,
  fileName,
  lineOf,
  onSelect,
  onFilterSignal,
}: {
  t: TriagedTransaction;
  status: TriageStatus;
  onStatusChange: (s: TriageStatus) => void;
  linkedCase?: LinkedCase;
  fileName: string;
  lineOf: (id: string) => number | undefined;
  onSelect: (id: string) => void;
  onFilterSignal: (kind: SignalKind) => void;
}) {
  const country = countryOf(t);
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-2xl font-bold text-foreground tabular-nums">
          {formatAmount(t.amount, t.currency)}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {directionLabel(t.amount)} · {formatTxDate(t)}
          {t.currency ? "" : " · devise non précisée"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge tone={RISK_TONE[t.risk]} title={RISK_RULE}>
            {RISK_LABELS[t.risk]}
          </StatusBadge>
          {t.sourceStatus ? (
            <StatusBadge tone="neutral" appearance="outline" dot={false}>
              Statut d&apos;origine : {t.sourceStatus}
            </StatusBadge>
          ) : null}
        </div>
      </div>

      <Section title="Triage">
        <SegmentedControl<TriageStatus>
          label="Statut de triage"
          size="sm"
          value={status}
          onValueChange={onStatusChange}
          options={TRIAGE_STATUSES.map((s) => ({ value: s, label: TRIAGE_LABELS[s] }))}
        />
        <p className="text-micro text-subtle">
          Conservé dans cet onglet pour ce fichier ; rien n&apos;est envoyé ni enregistré sur un serveur.
        </p>
      </Section>

      <Section title={`Signaux (${t.signals.length})`} icon={ShieldAlert}>
        {t.signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun détecteur ne s&apos;est déclenché sur cette transaction. Ce n&apos;est pas une
            attestation : seuls les doublons, montants atypiques et IBAN sont contrôlés.
          </p>
        ) : (
          <ul className="space-y-2">
            {t.signals.map((s, i) => (
              <li
                key={`${s.kind}-${i}`}
                className={cn("rounded-md border border-border border-l-2 bg-surface-2/50 p-2.5", TONE_STYLES[SIGNAL_TONE[s.kind]].edge)}
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge tone={SIGNAL_TONE[s.kind]}>{s.label}</StatusBadge>
                  <button
                    type="button"
                    onClick={() => onFilterSignal(s.kind)}
                    className="rounded-sm text-xs font-medium text-primary transition-ui hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Voir toutes
                  </button>
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  <span className="text-muted-foreground">Motif : </span>
                  {s.motif}
                </p>
                {s.related.length > 0 ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    Transactions liées :
                    {s.related.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className="rounded-sm px-1 font-medium text-primary tabular-nums transition-ui hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        ligne {lineOf(id)}
                      </button>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Contrepartie (entité)" icon={Network}>
        <dl className="space-y-1.5">
          <Row label="Nom">{t.counterparty ?? missing}</Row>
          {t.label && t.label !== t.counterparty ? <Row label="Libellé">{t.label}</Row> : null}
          <Row label="IBAN">
            {t.iban ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs break-all">{t.iban}</span>
                <StatusBadge tone={t.ibanValid ? "neutral" : "info"} appearance="outline">
                  {t.ibanValid ? "Structure valide" : "Invalide"}
                </StatusBadge>
              </span>
            ) : (
              missing
            )}
          </Row>
          <Row label={t.country ? "Pays" : "Pays (IBAN)"}>{country ?? missing}</Row>
          <Row label="SIREN">
            {t.siren ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="tabular-nums">{t.siren}</span>
                {t.sirenValid === false ? (
                  <StatusBadge tone="info" appearance="outline">
                    Clé de contrôle invalide
                  </StatusBadge>
                ) : null}
              </span>
            ) : (
              missing
            )}
          </Row>
        </dl>
      </Section>

      <Section title="Dossier KYB Graph" icon={FolderOpen}>
        {linkedCase ? (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              {linkedCase.title}
              <span className="text-muted-foreground"> · rapproché par le SIREN {linkedCase.rootSiren}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/cases/${linkedCase.id}/graphe`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Graphe du dossier <ArrowRight aria-hidden />
              </Link>
              <Link href={`/cases/${linkedCase.id}/risques`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Signaux du dossier <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        ) : t.siren ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Aucun dossier ne porte le SIREN {t.siren}.
            </p>
            <Link href="/cases/new" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Créer un dossier <ArrowRight aria-hidden />
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pas de SIREN pour cette contrepartie : rapprochement avec un dossier impossible.
          </p>
        )}
      </Section>

      <Section title="Source" icon={FileSpreadsheet}>
        <p className="text-sm text-foreground">
          {fileName} · ligne {t.line}
          {t.reference ? <span className="text-muted-foreground"> · réf. {t.reference}</span> : null}
        </p>
        <dl className="space-y-1 rounded-md border border-border-subtle bg-sunken p-2.5">
          {Object.entries(t.raw).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,8rem)_1fr] gap-2 text-xs">
              <dt className="truncate font-mono text-subtle">{k}</dt>
              <dd className="min-w-0 break-words font-mono text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

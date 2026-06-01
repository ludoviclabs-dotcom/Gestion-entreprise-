import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type {
  CaseBundle,
  CaseEdge,
  CaseEntity,
  CaseEvent,
  CaseRiskSignal,
  EvidenceLevel,
  Severity,
} from "@/lib/graph/graph-types";
import type { SourceRow } from "@/lib/data/types";

// Palette PDF — version contrastée pour impression (les tokens UI sombres
// sont remplacés par des nuances claires lisibles sur fond blanc).
const PALETTE = {
  bg: "#FFFFFF",
  ink: "#0A1628",
  inkSoft: "#475569",
  border: "#CBD5E1",
  borderSoft: "#E2E8F0",
  violet: "#5B21B6",
  emerald: "#047857",
  amber: "#B45309",
  red: "#B91C1C",
  blue: "#1D4ED8",
  surface: "#F8FAFC",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    color: PALETTE.ink,
    backgroundColor: PALETTE.bg,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
  },
  brand: { fontSize: 14, fontWeight: 700, color: PALETTE.violet },
  brandSub: { fontSize: 8, color: PALETTE.inkSoft, marginTop: 2 },
  metaCol: { textAlign: "right" },
  metaLine: { fontSize: 8, color: PALETTE.inkSoft },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: PALETTE.inkSoft,
    marginBottom: 14,
  },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  scorePill: {
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: "center",
  },
  scoreLabel: { fontSize: 8, color: PALETTE.inkSoft },
  scoreValue: { fontSize: 11, fontWeight: 700 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    color: PALETTE.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 8,
    color: PALETTE.inkSoft,
    marginBottom: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    borderRadius: 4,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.borderSoft,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: PALETTE.surface,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  th: { fontSize: 8, fontWeight: 700, color: PALETTE.inkSoft },
  td: { fontSize: 9 },
  badge: {
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 700,
  },
  signalCard: {
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  signalHead: { flexDirection: "row", gap: 6, alignItems: "center" },
  signalRule: { fontSize: 8, color: PALETTE.inkSoft },
  signalText: { marginTop: 4, fontSize: 9 },
  disclaimer: {
    marginTop: 16,
    padding: 8,
    backgroundColor: PALETTE.surface,
    borderLeftWidth: 3,
    borderLeftColor: PALETTE.violet,
    fontSize: 8,
    color: PALETTE.inkSoft,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: PALETTE.inkSoft,
  },
});

const SEVERITY_PALETTE: Record<Severity, { fg: string; bg: string; label: string }> = {
  info: { fg: PALETTE.inkSoft, bg: "#F1F5F9", label: "Info" },
  low: { fg: PALETTE.emerald, bg: "#D1FAE5", label: "Faible" },
  medium: { fg: PALETTE.amber, bg: "#FEF3C7", label: "Moyen" },
  high: { fg: PALETTE.red, bg: "#FEE2E2", label: "Élevé" },
};

const EVIDENCE_PALETTE: Record<EvidenceLevel, { fg: string; bg: string; label: string }> = {
  confirmed: { fg: PALETTE.emerald, bg: "#D1FAE5", label: "Confirmé" },
  declared: { fg: PALETTE.blue, bg: "#DBEAFE", label: "Déclaré" },
  inferred: { fg: PALETTE.amber, bg: "#FEF3C7", label: "Inféré" },
  simulated: { fg: PALETTE.red, bg: "#FEE2E2", label: "Simulé" },
};

const NODE_KIND_LABEL: Record<string, string> = {
  company: "Société",
  person: "Personne",
  address: "Adresse",
  event: "Événement",
  sanction: "Sanction",
};

function ScorePill({ label, value, tone }: { label: string; value?: number; tone: "risk" | "good" }) {
  const v = value;
  let color = PALETTE.inkSoft;
  if (v !== undefined) {
    if (tone === "good") color = v >= 67 ? PALETTE.emerald : v >= 34 ? PALETTE.amber : PALETTE.red;
    else color = v >= 67 ? PALETTE.red : v >= 34 ? PALETTE.amber : PALETTE.emerald;
  }
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, { color }]}>{v ?? "—"}</Text>
    </View>
  );
}

function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const p = EVIDENCE_PALETTE[level];
  return <Text style={[styles.badge, { color: p.fg, backgroundColor: p.bg }]}>{p.label}</Text>;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const p = SEVERITY_PALETTE[severity];
  return <Text style={[styles.badge, { color: p.fg, backgroundColor: p.bg }]}>{p.label}</Text>;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function shortHash(input?: string): string {
  if (!input) return "—";
  return input.length > 12 ? `${input.slice(0, 8)}…${input.slice(-4)}` : input;
}

interface CaseReportProps {
  bundle: CaseBundle;
  sources: SourceRow[];
  generatedAt: string;
  payloadHash: string;
}

export function CaseReport({ bundle, sources, generatedAt, payloadHash }: CaseReportProps) {
  const { case: c, entities, edges, events, riskSignals } = bundle;

  // Regroupements affichables par type d'entité.
  const groupedEntities = entities.reduce<Record<string, CaseEntity[]>>((acc, e) => {
    (acc[e.type] = acc[e.type] ?? []).push(e);
    return acc;
  }, {});

  const sortedEvents = [...events].sort((a, b) =>
    (b.occurredOn ?? "").localeCompare(a.occurredOn ?? ""),
  );

  return (
    <Document
      title={`Dossier KYB Graph — ${c.title}`}
      author="KYB Graph"
      subject={`Cartographie de conformité du dossier ${c.rootSiren}`}
    >
      <Page size="A4" style={styles.page} wrap>
        {/* En-tête identité */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>KYB Graph</Text>
            <Text style={styles.brandSub}>Cartographie de conformité — rapport opposable</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLine}>Édité le {formatDate(generatedAt)}</Text>
            <Text style={styles.metaLine}>Signature : {shortHash(payloadHash)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.subtitle}>
          SIREN {c.rootSiren} · {entities.length} entités · {edges.length} liens ·{" "}
          {events.length} événements · {riskSignals.length} signaux
        </Text>

        <View style={styles.scoreRow}>
          <ScorePill label="Complexité" value={c.scores?.complexite} tone="risk" />
          <ScorePill label="Vigilance" value={c.scores?.vigilance} tone="risk" />
          <ScorePill label="Qualité de preuve" value={c.scores?.qualitePreuve} tone="good" />
        </View>

        {/* Entités */}
        <Text style={styles.sectionTitle}>1. Entités cartographiées</Text>
        <Text style={styles.sectionHint}>
          Groupées par type. Niveau de preuve indiqué par badge.
        </Text>
        {Object.entries(groupedEntities).map(([kind, list]) => (
          <View key={kind} style={[styles.table, { marginBottom: 8 }]}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 3 }]}>
                {NODE_KIND_LABEL[kind] ?? kind} ({list.length})
              </Text>
              <Text style={[styles.th, { flex: 2 }]}>Détails</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Preuve</Text>
            </View>
            {list.map((e) => (
              <View key={e.id} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 3 }]}>{e.label}</Text>
                <Text style={[styles.td, { flex: 2, color: PALETTE.inkSoft }]}>
                  {Object.entries(e.attributes ?? {})
                    .slice(0, 2)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ") || "—"}
                </Text>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <EvidenceBadge level={e.evidenceLevel} />
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Liens */}
        <Text style={styles.sectionTitle}>2. Liens entre entités</Text>
        <Text style={styles.sectionHint}>
          Chaque lien porte un niveau de preuve. Les liens « inférés » ou
          « simulés » sont des hypothèses d&apos;analyse, jamais des preuves.
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1 }]}>Type</Text>
            <Text style={[styles.th, { flex: 2 }]}>Source</Text>
            <Text style={[styles.th, { flex: 2 }]}>Cible</Text>
            <Text style={[styles.th, { flex: 1 }]}>Poids</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Preuve</Text>
          </View>
          {edges.map((e) => (
            <EdgeRow key={e.id} edge={e} entities={entities} />
          ))}
        </View>

        {/* Timeline */}
        {events.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>3. Timeline juridique</Text>
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1 }]}>Date</Text>
                <Text style={[styles.th, { flex: 3 }]}>Titre</Text>
                <Text style={[styles.th, { flex: 1 }]}>Source</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Preuve</Text>
              </View>
              {sortedEvents.map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </View>
          </>
        )}

        {/* Signaux de risque */}
        <Text style={styles.sectionTitle}>4. Signaux de vigilance</Text>
        <Text style={styles.sectionHint}>
          Calculés à partir des règles déclenchées sur le graphe. Ce ne sont
          pas des qualifications de fraude.
        </Text>
        {riskSignals.length === 0 ? (
          <Text style={{ fontSize: 9, color: PALETTE.emerald }}>
            Aucun signal de vigilance détecté sur ce dossier.
          </Text>
        ) : (
          riskSignals.map((s) => <SignalCard key={s.id} signal={s} />)
        )}

        {/* Sources */}
        <Text style={styles.sectionTitle}>5. Sources & provenance</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { flex: 1 }]}>Source</Text>
            <Text style={[styles.th, { flex: 4 }]}>Point d&apos;accès</Text>
            <Text style={[styles.th, { flex: 1 }]}>Statut</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Origine</Text>
          </View>
          {sources.map((s, i) => (
            <View key={`${s.source}-${i}`} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 1 }]}>{s.source}</Text>
              <Text style={[styles.td, { flex: 4, fontSize: 7, color: PALETTE.inkSoft }]}>
                {s.endpoint}
              </Text>
              <Text style={[styles.td, { flex: 1 }]}>
                {s.httpStatus === 0 ? "—" : String(s.httpStatus)}
              </Text>
              <Text
                style={[
                  styles.td,
                  { flex: 1, textAlign: "right", color: s.isFixture ? PALETTE.amber : PALETTE.emerald },
                ]}
              >
                {s.isFixture ? "Démonstration" : "Live"}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Avertissement légal — ce rapport agrège des informations issues de
          registres officiels et de sources publiques. Les niveaux de preuve
          « inféré » et « simulé » identifient des hypothèses d&apos;analyse
          qui ne valent pas qualification factuelle. Aucun élément ne doit
          être interprété comme une accusation de fraude. Référentiel
          réglementaire applicable : Règlement (UE) 2024/1624 (AMLR),
          obligations Tracfin / ACPR, RGPD. La traçabilité des sources est
          garantie par les empreintes SHA-256 annexées.
        </Text>

        <View style={styles.footer} fixed>
          <Text>
            KYB Graph · Dossier {c.rootSiren} · {formatDate(generatedAt)}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function EdgeRow({ edge, entities }: { edge: CaseEdge; entities: CaseEntity[] }) {
  const findLabel = (id: string) => entities.find((e) => e.id === id)?.label ?? id;
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.td, { flex: 1, color: PALETTE.inkSoft }]}>{edge.type}</Text>
      <Text style={[styles.td, { flex: 2 }]}>{findLabel(edge.source)}</Text>
      <Text style={[styles.td, { flex: 2 }]}>{findLabel(edge.target)}</Text>
      <Text style={[styles.td, { flex: 1, color: PALETTE.inkSoft }]}>
        {edge.weight ?? "—"}
      </Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <EvidenceBadge level={edge.evidenceLevel} />
      </View>
    </View>
  );
}

function EventRow({ event }: { event: CaseEvent }) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.td, { flex: 1 }]}>{formatDate(event.occurredOn)}</Text>
      <Text style={[styles.td, { flex: 3 }]}>{event.title}</Text>
      <Text style={[styles.td, { flex: 1, color: PALETTE.inkSoft }]}>
        {event.source ?? "—"}
      </Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <EvidenceBadge level={event.evidenceLevel} />
      </View>
    </View>
  );
}

function SignalCard({ signal }: { signal: CaseRiskSignal }) {
  return (
    <View style={styles.signalCard}>
      <View style={styles.signalHead}>
        <SeverityBadge severity={signal.severity} />
        <Text style={styles.signalRule}>
          {signal.ruleId} · {signal.category}
        </Text>
      </View>
      <Text style={styles.signalText}>{signal.explanation}</Text>
    </View>
  );
}

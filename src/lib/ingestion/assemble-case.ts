import type { CaseBundle, CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type { ConnectorResult, SourceRecordInput } from "@/lib/connectors/types";
import type { SourceKind } from "@/lib/graph/source";
import { sirene } from "@/lib/connectors/sirene";
import { bodacc } from "@/lib/connectors/bodacc";
import { inpi } from "@/lib/connectors/inpi";
import { tresorGels } from "@/lib/connectors/tresor-gels";
import { openSanctions } from "@/lib/connectors/opensanctions";
import { normalizeSirene } from "./normalize-sirene";
import { normalizeBodacc } from "./normalize-bodacc";
import { normalizeInpi } from "./normalize-inpi";
import { normalizeGels } from "./normalize-gels";
import { normalizeOpenSanctions } from "./normalize-opensanctions";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeRisk } from "@/lib/risk/engine";

function toSource(source: SourceKind, r: ConnectorResult<unknown>): SourceRecordInput {
  return {
    source,
    endpoint: r.endpoint,
    httpStatus: r.httpStatus,
    raw: r.raw,
    isFixture: r.isFixture,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/**
 * Orchestre les connecteurs (Sirene + BODACC + INPI + gels), normalise et fusionne
 * en un CaseBundle prêt pour le graphe. Renvoie aussi les source_records pour
 * persistance ultérieure (Phase 2 DB). En mode démo, tout vient des fixtures.
 */
export async function assembleCase(
  siren: string,
): Promise<{ bundle: CaseBundle; sources: SourceRecordInput[] }> {
  const sources: SourceRecordInput[] = [];

  const ul = await sirene.getUniteLegale(siren);
  sources.push(toSource("sirene", ul));
  const nic = normalizeSirene(ul.raw, {}).nic;

  const etab = await sirene.getEtablissementSiege(siren, nic);
  sources.push(toSource("sirene", etab));

  const sireneNorm = normalizeSirene(ul.raw, etab.raw);
  const companyId = sireneNorm.companyId;

  const bodaccRes = await bodacc.bySiren(siren);
  sources.push(toSource("bodacc", bodaccRes));
  const events = normalizeBodacc(bodaccRes.raw, companyId);

  const inpiRes = await inpi.getRne(siren);
  sources.push(toSource("inpi", inpiRes));
  const inpiNorm = normalizeInpi(inpiRes.raw, companyId);

  const gelsRes = await tresorGels.match({
    siren,
    name: sireneNorm.denomination ?? undefined,
  });
  sources.push(toSource("tresor_gels", gelsRes));
  const gelsNorm = normalizeGels(gelsRes.raw, { companyId });

  // OpenSanctions — agrégat UE de listes sanctions/PEP. Le registre national
  // (DG Trésor gels) reste en parallèle (déduplication via natural key).
  const osRes = await openSanctions.match({
    company: {
      schema: "Company",
      name: sireneNorm.denomination ?? `SIREN ${siren}`,
      identifier: siren,
    },
  });
  sources.push(toSource("opensanctions", osRes));
  const osNorm = normalizeOpenSanctions(osRes.raw, {
    subjectId: companyId,
    subjectLabel: sireneNorm.denomination ?? `SIREN ${siren}`,
  });

  const entities: CaseEntity[] = dedupeById([
    ...sireneNorm.entities,
    ...inpiNorm.entities,
    ...gelsNorm.entities,
    ...osNorm.entities,
  ]);
  const edges: CaseEdge[] = dedupeById([
    ...sireneNorm.edges,
    ...inpiNorm.edges,
    ...gelsNorm.edges,
    ...osNorm.edges,
  ]);

  const bundle: CaseBundle = {
    case: {
      id: siren,
      title: sireneNorm.denomination ?? `SIREN ${siren}`,
      rootSiren: siren,
    },
    entities,
    edges,
    events,
    riskSignals: [],
  };

  // Étape 1.1 — moteur de risque computé : signaux + scores dérivés du graphe.
  const graph = buildGraph(bundle);
  const { signals, scores } = computeRisk(bundle, graph);
  bundle.riskSignals = signals;
  bundle.case.scores = scores;

  return { bundle, sources };
}

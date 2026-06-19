import type { CaseBundle, CaseEntity, CaseEdge } from "@/lib/graph/graph-types";
import type { ConnectorResult, SourceRecordInput } from "@/lib/connectors/types";
import type { SourceKind } from "@/lib/graph/source";
import { sirene } from "@/lib/connectors/sirene";
import { bodacc } from "@/lib/connectors/bodacc";
import { inpi } from "@/lib/connectors/inpi";
import { tresorGels } from "@/lib/connectors/tresor-gels";
import { openSanctions } from "@/lib/connectors/opensanctions";
import { gleif } from "@/lib/connectors/gleif";
import { vies } from "@/lib/connectors/vies";
import { ban, banAddressFrom } from "@/lib/connectors/ban";
import { gdelt } from "@/lib/connectors/gdelt";
import { isDemoMode } from "@/lib/env";
import { normalizeSirene, sireneAddress } from "./normalize-sirene";
import { normalizeBodacc } from "./normalize-bodacc";
import { normalizeInpi } from "./normalize-inpi";
import { normalizeGels } from "./normalize-gels";
import { normalizeOpenSanctions } from "./normalize-opensanctions";
import { normalizeGleif } from "./normalize-gleif";
import { normalizeGdelt } from "./normalize-gdelt";
import { buildGraph } from "@/lib/graph/build-graph";
import { computeRisk } from "@/lib/risk/engine";
import { payloadHash } from "@/lib/audit/hash-chain";

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
 * En mode LIVE, un connecteur désactivé (flag à false) renvoie sa fixture
 * (`isFixture:true`). On ne doit JAMAIS enrichir un dossier réel avec ces données
 * d'échantillon (LEI / TVA / adresse Danone) : un résultat n'est exploité que
 * s'il est réel, OU si l'on est en mode démo (où la fixture EST la donnée voulue).
 */
function usableResult(r: { isFixture: boolean }): boolean {
  return isDemoMode() || !r.isFixture;
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

  // BAN — normalisation/géocodage de l'adresse du siège : clé d'adresse canonique
  // → clustering de domiciliation fiable (ADRESSE_PARTAGEE/CONCENTRATION).
  const banRes = await ban.geocode(sireneAddress(etab.raw)?.label ?? "");
  sources.push(toSource("ban", banRes));
  const banAddr = usableResult(banRes) ? banAddressFrom(banRes.raw) : null;

  const sireneNorm = normalizeSirene(ul.raw, etab.raw, banAddr);
  const companyId = sireneNorm.companyId;

  const bodaccRes = await bodacc.bySiren(siren);
  sources.push(toSource("bodacc", bodaccRes));
  const events = normalizeBodacc(bodaccRes.raw, companyId);

  const inpiRes = await inpi.getRne(siren);
  sources.push(toSource("inpi", inpiRes));
  const inpiNorm = normalizeInpi(inpiRes.raw, companyId);
  // Bénéficiaires effectifs DÉCLARÉS (pour l'écart UBO) — toujours extraits pour
  // le calcul ; l'affichage nominatif reste gaté (CJUE) côté panneau/règle.
  const declaredUboRaw = (
    inpiRes.raw as {
      beneficiairesEffectifs?: {
        nom?: string;
        prenoms?: string;
        modaliteControle?: string;
      }[];
    }
  ).beneficiairesEffectifs;
  // Trace de provenance commune : endpoint INPI + empreinte du payload brut
  // (corrobore source_records.payload_hash et le journal de preuve).
  const inpiTrace = {
    sourceEndpoint: inpiRes.endpoint,
    sourcePayloadHash: payloadHash(inpiRes.raw),
  };
  const declaredUbo = (declaredUboRaw ?? [])
    .map((b) => ({
      label: [b.prenoms, b.nom].filter(Boolean).join(" ").trim(),
      nom: b.nom,
      prenoms: b.prenoms,
      modaliteControle: b.modaliteControle,
      ...inpiTrace,
    }))
    .filter((b) => b.label.length > 0);

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

  // GLEIF — structure de détention transfrontalière (sociétés mères de niveau 2).
  // Arêtes DETIENT structurelles (sans %, GLEIF ne publie pas de participations).
  const gleifRes = await gleif.bySiren(siren);
  sources.push(toSource("gleif", gleifRes));
  const gleifNorm = usableResult(gleifRes)
    ? normalizeGleif(gleifRes.raw, companyId)
    : { entities: [], edges: [], subjectLei: null };

  // VIES — validation de la TVA intracommunautaire (corroboration d'identité,
  // pas un signal de risque : un `valid:false` est neutre pour une PME domestique).
  const viesRes = await vies.validateFr(siren);
  sources.push(toSource("vies", viesRes));
  const viesData = usableResult(viesRes)
    ? (viesRes.raw as { vatNumber?: string | null; valid?: boolean | null })
    : { vatNumber: null, valid: null };

  const entities: CaseEntity[] = dedupeById([
    ...sireneNorm.entities,
    ...inpiNorm.entities,
    ...gleifNorm.entities,
    ...gelsNorm.entities,
    ...osNorm.entities,
  ]);
  const edges: CaseEdge[] = dedupeById([
    ...sireneNorm.edges,
    ...inpiNorm.edges,
    ...gleifNorm.edges,
    ...gelsNorm.edges,
    ...osNorm.edges,
  ]);

  // Enrichissement du nœud société racine avec son LEI (GLEIF). Le nœud Sirene
  // est prioritaire (dédupliqué en premier) → on lui ajoute l'attribut LEI.
  if (gleifNorm.subjectLei) {
    const subject = entities.find((e) => e.id === companyId);
    if (subject) {
      subject.attributes = { ...subject.attributes, LEI: gleifNorm.subjectLei };
    }
  }

  // Enrichissement TVA intracommunautaire (VIES) sur le nœud société racine.
  if (viesData.vatNumber) {
    const subject = entities.find((e) => e.id === companyId);
    if (subject) {
      const statut =
        viesData.valid === true
          ? "active"
          : viesData.valid === false
            ? "inactive"
            : "indéterminée";
      subject.attributes = {
        ...subject.attributes,
        "TVA intracommunautaire": viesData.vatNumber,
        "Statut TVA (VIES)": statut,
      };
    }
  }

  // GDELT — couverture médiatique (presse). Après construction des entités :
  // appariement nominatif au graphe (résolution d'entité), faisceau via revue
  // humaine. Gaté : en live, un connecteur désactivé ne pollue pas le dossier.
  const gdeltRes = await gdelt.byName(sireneNorm.denomination ?? `SIREN ${siren}`);
  sources.push(toSource("gdelt", gdeltRes));
  const mediaEvents = usableResult(gdeltRes)
    ? normalizeGdelt(gdeltRes.raw, { subjectId: companyId, entities })
    : [];

  const bundle: CaseBundle = {
    case: {
      id: siren,
      title: sireneNorm.denomination ?? `SIREN ${siren}`,
      rootSiren: siren,
    },
    entities,
    edges,
    events: [...events, ...mediaEvents],
    riskSignals: [],
    ...(declaredUbo.length > 0 ? { declaredUbo } : {}),
  };

  // Étape 1.1 — moteur de risque computé : signaux + scores dérivés du graphe.
  const graph = buildGraph(bundle);
  const { signals, scores } = computeRisk(bundle, graph);
  bundle.riskSignals = signals;
  bundle.case.scores = scores;

  return { bundle, sources };
}

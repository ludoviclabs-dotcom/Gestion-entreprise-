import type { CaseBundle, CaseEdge, CaseEntity } from "@/lib/graph/graph-types";
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
import { pappers } from "@/lib/connectors/pappers";
import { companiesHouse } from "@/lib/connectors/companies-house";
import {
  LABEL_ALIM_CONFIANCE,
  LABEL_BIO,
  LABEL_ORGANISME_FORMATION,
  LABEL_QUALIOPI,
  LABEL_RGE,
  rechercheEntreprises,
} from "@/lib/connectors/recherche-entreprises";
import { balo } from "@/lib/connectors/balo";
import { boamp } from "@/lib/connectors/boamp";
import { dca, joafe, isRna } from "@/lib/connectors/associations";
import { rge } from "@/lib/connectors/rge";
import { agenceBio } from "@/lib/connectors/agence-bio";
import { alimConfiance } from "@/lib/connectors/alim-confiance";
import { qualiopi } from "@/lib/connectors/qualiopi";
import { isDegradedEndpoint } from "@/lib/connectors/degraded";
import {
  isAgenceBioEnabled,
  isAlimConfianceEnabled,
  isBaloEnabled,
  isBoampEnabled,
  isCompaniesHouseEnabled,
  isDcaEnabled,
  isDemoMode,
  isInpiUboExposed,
  isJoafeEnabled,
  isQualiopiEnabled,
  isRechercheEntreprisesEnabled,
  isRgeEnabled,
} from "@/lib/env";
import {
  dilaAttributes,
  normalizeBalo,
  normalizeBoamp,
  normalizeDca,
  normalizeJoafe,
} from "./normalize-dila";
import { labelsAttributes } from "./normalize-labels";
import { normalizeSirene, sireneAddress } from "./normalize-sirene";
import { normalizeBodacc } from "./normalize-bodacc";
import { normalizeInpi } from "./normalize-inpi";
import { normalizeGels } from "./normalize-gels";
import { normalizeOpenSanctions } from "./normalize-opensanctions";
import { companiesHouseParents, normalizeGleif } from "./normalize-gleif";
import { normalizeCompaniesHouse } from "./normalize-companies-house";
import {
  rechercheAttributes,
  rechercheDirigeants,
} from "./normalize-recherche-entreprises";
import { normalizeGdelt } from "./normalize-gdelt";
import { normalizePappers, pappersDirigeants } from "./normalize-pappers";
import { getEntityResolver } from "./resolver-backend";
import { SourceError } from "./errors";
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
  // Sirene fonde l'identité du dossier : sans elle (clé absente → fixture, ou
  // réponse en erreur), un dossier « réel » porterait l'identité d'un échantillon
  // ou des données d'erreur. On refuse explicitement plutôt que de fabriquer.
  if (!usableResult(ul)) {
    throw new SourceError(
      "sirene",
      "Création impossible : la clé INSEE Sirene n'est pas configurée (INSEE_SIRENE_API_KEY). Aucun dossier réel ne peut être construit sans identité légale vérifiable.",
    );
  }
  if (ul.httpStatus === 404) {
    throw new SourceError("sirene", `SIREN ${siren} introuvable dans le répertoire Sirene (INSEE).`);
  }
  if (ul.httpStatus >= 400) {
    throw new SourceError(
      "sirene",
      `L'API INSEE Sirene a refusé la requête (HTTP ${ul.httpStatus}) : vérifier la clé et la souscription à l'API Sirene.`,
    );
  }
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

  // Sources INDÉPENDANTES les unes des autres (elles ne dépendent que du SIREN et
  // de la dénomination) : appelées EN PARALLÈLE. La durée d'un dossier devient
  // celle de la source la plus lente et non la somme (≈ 60 s auparavant). Chaque
  // connecteur isole ses propres erreurs ; l'ordre des source_records ci-dessous
  // reste déterministe.
  const subjectLabel = sireneNorm.denomination ?? `SIREN ${siren}`;
  // « Recherche d'entreprises » : appelée seulement en live ET activée — sinon
  // aucune consultation, donc aucune ligne source_records (source non interrogée).
  const rechercheOn = !isDemoMode() && isRechercheEntreprisesEnabled();
  // Lot « DILA » (BALO, BOAMP, DCA) : mêmes règles — live ET activé, sinon aucune
  // consultation ni ligne source_records. Les deux jeux « associations » ne sont
  // interrogés que pour une catégorie juridique 9xxx (associations, fondations,
  // fonds de dotation) : aucun appel inutile pour une société commerciale.
  const live = !isDemoMode();
  const isAssociation = /^9/.test(sireneNorm.legalCategory ?? "");
  const baloOn = live && isBaloEnabled();
  const boampOn = live && isBoampEnabled();
  const dcaOn = live && isDcaEnabled() && isAssociation;
  const [
    bodaccRes,
    inpiRes,
    gelsRes,
    osRes,
    gleifRes,
    viesRes,
    pappersRes,
    gdeltRes,
    rechercheRes,
    baloRes,
    boampRes,
    dcaRes,
  ] =
    await Promise.all([
      bodacc.bySiren(siren),
      inpi.getRne(siren),
      tresorGels.match({ siren, name: sireneNorm.denomination ?? undefined }),
      // OpenSanctions — agrégat UE de listes sanctions/PEP. Le registre national
      // (DG Trésor gels) reste en parallèle (déduplication via natural key).
      openSanctions.match({
        company: { schema: "Company", name: subjectLabel, identifier: siren },
      }),
      gleif.bySiren(siren),
      vies.validateFr(siren),
      pappers.bySiren(siren),
      gdelt.byName(subjectLabel),
      rechercheOn ? rechercheEntreprises.bySiren(siren) : Promise.resolve(null),
      baloOn ? balo.bySiren(siren) : Promise.resolve(null),
      boampOn ? boamp.bySiren(siren) : Promise.resolve(null),
      dcaOn ? dca.bySiren(siren) : Promise.resolve(null),
    ]);
  sources.push(
    toSource("bodacc", bodaccRes),
    toSource("inpi", inpiRes),
    toSource("tresor_gels", gelsRes),
    toSource("opensanctions", osRes),
    toSource("gleif", gleifRes),
    toSource("vies", viesRes),
    toSource("pappers", pappersRes),
    toSource("gdelt", gdeltRes),
  );
  if (rechercheRes) sources.push(toSource("recherche_entreprises", rechercheRes));
  if (baloRes) sources.push(toSource("balo", baloRes));
  if (boampRes) sources.push(toSource("boamp", boampRes));
  if (dcaRes) sources.push(toSource("dca", dcaRes));

  // Annonces JOAFE : rapprochées par numéro RNA (et non par SIREN). Le RNA vient
  // d'abord des dépôts de comptes (DCA), à défaut de Recherche d'entreprises.
  // Séquentiel (dépend du RNA) ; sans RNA valide : aucune consultation.
  // Périmètre : associations. Les fondations et fonds de dotation (9300) n'ont
  // pas de RNA — leurs annonces sont indexées par RNF, qu'aucune source ne relie
  // au SIREN : seuls leurs dépôts de comptes (DCA, par SIREN) sont consultés.
  const rnaOf = (raw: unknown): string | null => {
    const v = (raw as { rna?: unknown } | null)?.rna;
    return typeof v === "string" ? v : null;
  };
  const rna = [
    dcaRes && !dcaRes.isFixture ? rnaOf(dcaRes.raw) : null,
    rechercheRes && !rechercheRes.isFixture ? rnaOf(rechercheRes.raw) : null,
  ].find(isRna);
  // Consultation de jeu ouvert exploitable : réussie (2xx), non fixture, non
  // dégradée (DILA, labels).
  const openDataUsable = (
    r: ConnectorResult<unknown> | null,
  ): r is ConnectorResult<unknown> =>
    r !== null &&
    !r.isFixture &&
    r.httpStatus >= 200 &&
    r.httpStatus < 300 &&
    !isDegradedEndpoint(r.endpoint);

  // Détail des LABELS publics (RGE, Agence BIO, Alim'confiance, Qualiopi) :
  // interrogé SEULEMENT quand Recherche d'entreprises signale le label (donc
  // après elle) — jamais pour une société qui ne le porte pas. Sans réponse
  // exploitable de Recherche d'entreprises, aucun label n'est connu : aucun appel.
  const flaggedLabels = new Set<string>(
    openDataUsable(rechercheRes) && Array.isArray((rechercheRes.raw as { labels?: unknown })?.labels)
      ? ((rechercheRes.raw as { labels: unknown[] }).labels.filter(
          (l) => typeof l === "string",
        ) as string[])
      : [],
  );
  // Une seule vague parallèle : JOAFE (dépend du RNA) et les 4 labels.
  const none = Promise.resolve(null);
  const [joafeRes, rgeRes, bioRes, alimRes, qualiopiRes] = await Promise.all([
    live && isJoafeEnabled() && isAssociation && rna ? joafe.byRna(rna) : none,
    live && isRgeEnabled() && flaggedLabels.has(LABEL_RGE) ? rge.bySiren(siren) : none,
    live && isAgenceBioEnabled() && flaggedLabels.has(LABEL_BIO)
      ? agenceBio.bySiren(siren)
      : none,
    live && isAlimConfianceEnabled() && flaggedLabels.has(LABEL_ALIM_CONFIANCE)
      ? alimConfiance.bySiren(siren)
      : none,
    // Organisme de formation déclaré OU certifié Qualiopi : un organisme non
    // certifié n'a que le premier indicateur mais figure dans la liste DGEFP.
    live &&
    isQualiopiEnabled() &&
    (flaggedLabels.has(LABEL_QUALIOPI) || flaggedLabels.has(LABEL_ORGANISME_FORMATION))
      ? qualiopi.bySiren(siren)
      : none,
  ]);
  if (joafeRes) sources.push(toSource("joafe", joafeRes));
  if (rgeRes) sources.push(toSource("rge", rgeRes));
  if (bioRes) sources.push(toSource("agence_bio", bioRes));
  if (alimRes) sources.push(toSource("alim_confiance", alimRes));
  if (qualiopiRes) sources.push(toSource("qualiopi", qualiopiRes));

  // Repli fixture (BODACC en panne) ou mode live : jamais d'annonces d'échantillon
  // sur un dossier réel.
  const bodaccEvents = usableResult(bodaccRes)
    ? normalizeBodacc(bodaccRes.raw, companyId)
    : [];
  const events = [
    ...bodaccEvents,
    ...(openDataUsable(baloRes) ? normalizeBalo(baloRes.raw, companyId) : []),
    ...(openDataUsable(boampRes) ? normalizeBoamp(boampRes.raw, companyId) : []),
    ...(openDataUsable(dcaRes) ? normalizeDca(dcaRes.raw, companyId) : []),
    ...(openDataUsable(joafeRes) ? normalizeJoafe(joafeRes.raw, companyId) : []),
  ];

  // Sans identifiants INPI en mode live, `inpiRes` est la fixture (dirigeants
  // DANONE) : on ne l'applique pas à un dossier réel.
  const inpiUsable = usableResult(inpiRes);
  const inpiNorm = inpiUsable
    ? normalizeInpi(inpiRes.raw, companyId)
    : { entities: [], edges: [] };
  // Bénéficiaires effectifs DÉCLARÉS (pour l'écart UBO) — toujours extraits pour
  // le calcul ; l'affichage nominatif reste gaté (CJUE) côté panneau/règle.
  const declaredUboRaw = inpiUsable
    ? (
        inpiRes.raw as {
          beneficiairesEffectifs?: {
            nom?: string;
            prenoms?: string;
            modaliteControle?: string;
          }[];
        }
      ).beneficiairesEffectifs
    : undefined;
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

  // DG Trésor — rapprochement dénomination ↔ registre des gels (hypothèse, jamais
  // un fait : cf. normalizeGels).
  const gelsNorm = usableResult(gelsRes)
    ? normalizeGels(gelsRes.raw, { companyId })
    : { entities: [], edges: [] };

  const osNorm = usableResult(osRes)
    ? normalizeOpenSanctions(osRes.raw, {
        subjectId: companyId,
        subjectLabel,
      })
    : { entities: [], edges: [] };

  // GLEIF — structure de détention transfrontalière (sociétés mères de niveau 2).
  // Arêtes DETIENT structurelles (sans %, GLEIF ne publie pas de participations).
  const gleifNorm = usableResult(gleifRes)
    ? normalizeGleif(gleifRes.raw, companyId)
    : { entities: [], edges: [], subjectLei: null };

  // Companies House — SECOND SAUT : dirigeants et personnes à contrôle significatif
  // des sociétés mères BRITANNIQUES repérées par GLEIF (registre RA000585/586/587).
  // Appelé seulement en mode live ET connecteur activé : sinon aucune consultation,
  // donc aucune ligne source_records (la source n'a pas été interrogée).
  const chParents =
    !isDemoMode() && isCompaniesHouseEnabled() && usableResult(gleifRes)
      ? companiesHouseParents(gleifRes.raw)
      : [];
  const chResults = await Promise.all(
    chParents.map((p) => companiesHouse.byNumber(p.number)),
  );
  for (const r of chResults) sources.push(toSource("companies_house", r));
  const chNorm: { entities: CaseEntity[]; edges: CaseEdge[] } = { entities: [], edges: [] };
  chParents.forEach((parent, i) => {
    const res = chResults[i];
    // 404 (numéro inconnu) ou panne : rien à greffer, jamais une donnée inventée.
    if (res.isFixture || res.httpStatus < 200 || res.httpStatus >= 300) return;
    const parentId = `co:lei:${parent.lei}`;
    const n = normalizeCompaniesHouse(res.raw, {
      companyId: parentId,
      // Garde-fou UBO : PSC personnes physiques exposées comme les UBO INPI.
      exposeIndividualPsc: isInpiUboExposed(),
    });
    chNorm.entities.push(...n.entities);
    chNorm.edges.push(...n.edges);
    const parentNode = gleifNorm.entities.find((e) => e.id === parentId);
    if (parentNode) {
      parentNode.attributes = { ...parentNode.attributes, ...n.companyAttributes };
    }
  });

  // VIES — validation de la TVA intracommunautaire (corroboration d'identité,
  // pas un signal de risque : un `valid:false` est neutre pour une PME domestique).
  const viesData = usableResult(viesRes)
    ? (viesRes.raw as { vatNumber?: string | null; valid?: boolean | null })
    : { vatNumber: null, valid: null };

  // Pappers — ses dirigeants rejoignent l'entrée du résolveur (un dirigeant vu par
  // l'INPI ET Pappers est fusionné), et ses comptes annuels enrichissent ensuite
  // le nœud société canonique. Une réponse en erreur (clé refusée, quota) est
  // signalée par son statut HTTP : jamais exploitée.
  const pappersUsable = usableResult(pappersRes) && pappersRes.httpStatus < 400;
  const pappersPeople = pappersUsable
    ? pappersDirigeants(pappersRes.raw, companyId)
    : { entities: [], edges: [] };

  // Recherche d'entreprises (DINUM) — dirigeants publiés au RNE + derniers
  // comptes + indicateurs publics. Source ouverte, sans clé : prend le relais de
  // l'INPI (accès API restreint) et de Pappers (crédits). Utilisée seulement si la
  // consultation a RÉUSSI : un échec ou une absence ne produit rien (jamais « aucun
  // dirigeant »). Les attributs sont greffés après résolution.
  const rechercheUsable =
    rechercheRes != null &&
    !rechercheRes.isFixture &&
    rechercheRes.httpStatus >= 200 &&
    rechercheRes.httpStatus < 300 &&
    !isDegradedEndpoint(rechercheRes.endpoint);
  const recherchePeople =
    rechercheUsable && rechercheRes
      ? rechercheDirigeants(rechercheRes.raw, companyId)
      : { entities: [], edges: [] };

  // Résolution d'entité : dédoublonnage INTER-SOURCES (une même société/personne
  // vue par Sirene, INPI et GLEIF est fusionnée ; arêtes re-pointées vers l'id
  // canonique, preuve la plus forte conservée). AVANT enrichissement/GDELT :
  // l'id du sujet peut devenir un id canonique différent → on le remappe via
  // l'idMap. Indispensable pour des métriques (degré, centralité, UBO) non
  // biaisées par des doublons. Seam builtin/splink (RESOLVER_BACKEND).
  const resolved = await getEntityResolver().resolve({
    entities: dedupeById([
      ...sireneNorm.entities,
      ...inpiNorm.entities,
      ...gleifNorm.entities,
      ...gelsNorm.entities,
      ...osNorm.entities,
      ...pappersPeople.entities,
      ...recherchePeople.entities,
      ...chNorm.entities,
    ]),
    edges: dedupeById([
      ...sireneNorm.edges,
      ...inpiNorm.edges,
      ...gleifNorm.edges,
      ...gelsNorm.edges,
      ...osNorm.edges,
      ...pappersPeople.edges,
      ...recherchePeople.edges,
      ...chNorm.edges,
    ]),
  });
  const resolvedEntities = resolved.entities;
  const resolvedEdges = resolved.edges;
  const remapId = (id: string): string => resolved.idMap[id] ?? id;
  const canonicalSubjectId = remapId(companyId);

  // Enrichissement LEI (GLEIF) + TVA (VIES) sur le nœud société CANONIQUE (après
  // résolution) → survit quel que soit le membre retenu comme entité canonique.
  const subject = resolvedEntities.find((e) => e.id === canonicalSubjectId);
  if (subject) {
    if (gleifNorm.subjectLei) {
      subject.attributes = { ...subject.attributes, LEI: gleifNorm.subjectLei };
    }
    if (viesData.vatNumber) {
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
    // Comptes publiés, indicateurs publics, commissaires aux comptes, fraîcheur du
    // RNE (Recherche d'entreprises). Appliqués AVANT Pappers : si Pappers répond,
    // ses comptes (plus complets) prennent le pas.
    if (rechercheUsable && rechercheRes) {
      subject.attributes = {
        ...subject.attributes,
        ...rechercheAttributes(rechercheRes.raw),
      };
    }
    // Volumes publiés (BALO, BOAMP, JOAFE, DCA) — la liste d'événements est plafonnée.
    subject.attributes = {
      ...subject.attributes,
      ...dilaAttributes({
        balo: openDataUsable(baloRes) ? baloRes.raw : null,
        boamp: openDataUsable(boampRes) ? boampRes.raw : null,
        dca: openDataUsable(dcaRes) ? dcaRes.raw : null,
        joafe: openDataUsable(joafeRes) ? joafeRes.raw : null,
      }),
      // Détail des labels publics (RGE, bio, Alim'confiance, Qualiopi).
      ...labelsAttributes({
        rge: openDataUsable(rgeRes) ? rgeRes.raw : null,
        bio: openDataUsable(bioRes) ? bioRes.raw : null,
        alim: openDataUsable(alimRes) ? alimRes.raw : null,
        qualiopi: openDataUsable(qualiopiRes) ? qualiopiRes.raw : null,
      }),
    };
  }

  // GDELT — couverture médiatique (presse), appariée au graphe CANONIQUE.
  const mediaEvents = usableResult(gdeltRes)
    ? normalizeGdelt(gdeltRes.raw, {
        subjectId: canonicalSubjectId,
        entities: resolvedEntities,
      })
    : [];

  // Pappers — comptes annuels (CA, résultat net, capitaux propres) du dernier
  // exercice publié. Enrichit le nœud société CANONIQUE en place (la
  // normalisation mute `subject.attributes`, comme LEI/TVA). Même garde que les
  // dirigeants : aucun enrichissement d'un dossier réel avec la fixture ou une erreur.
  if (pappersUsable) {
    normalizePappers(pappersRes.raw, canonicalSubjectId, resolvedEntities);
  }

  // Re-pointer les événements (BODACC) vers les ids canoniques après résolution.
  const resolvedEvents = events.map((e) => ({
    ...e,
    entityId: remapId(e.entityId),
  }));

  const bundle: CaseBundle = {
    case: {
      id: siren,
      title: sireneNorm.denomination ?? `SIREN ${siren}`,
      rootSiren: siren,
    },
    entities: resolvedEntities,
    edges: resolvedEdges,
    events: [...resolvedEvents, ...mediaEvents],
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

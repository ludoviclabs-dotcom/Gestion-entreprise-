# Modèle de données — niveaux de preuve et provenance

## Les 4 niveaux de preuve

Toute information dans KYB Graph porte un niveau de preuve. C'est un **garde-fou produit non négociable** — un lien `inferred` ou `simulated` ne sera **jamais** affiché comme un fait, ni utilisé pour formuler une accusation.

| Niveau | Définition | Visual | Cas d'usage |
|---|---|---|---|
| **`confirmed`** | Source officielle ou registre faisant foi | Trait épais (3.5px), opacité 100 % | Registre Sirene (INSEE), BODACC, événement juridique publié |
| **`declared`** | Déclaration publique d'un acteur (dirigeant, société) | Trait épais (2.2px), opacité 85 % | Dirigeant déclaré au RNE/RCS, UBO déclaré |
| **`inferred`** | Indice concordant déduit du graphe ou d'une corrélation | Trait fin (1.3px), opacité 60 % | Lien capitalistique déduit, détention partielle estimée |
| **`simulated`** | Hypothèse de travail, scénario, match approximatif | Trait fin (1.0px), opacité 45 % | Match nominal OpenSanctions avec score < seuil exact |

Constantes dans `src/lib/graph/graph-types.ts` :
- `EVIDENCE_EDGE_COLORS` — couleur (palette neutre sur fond navy).
- `EVIDENCE_EDGE_SIZE` — épaisseur de trait (encodage **a11y** pour daltoniens).
- `EVIDENCE_EDGE_OPACITY` — opacité (encodage hiérarchique).

> **Double encodage** (Audit WCAG 2.1/2.2) : la couleur **n'est jamais** le seul signal. La taille de trait et l'opacité encodent le même niveau. Légende `Legend.tsx` montre les deux canaux.

## Niveau par défaut par type d'edge

Quand un connecteur produit un edge sans préciser, le niveau est déterminé par sa source :

| Edge | Source | Niveau par défaut | Justification |
|---|---|---|---|
| `DIRIGE` | INPI / RNE | `declared` | Dirigeant déclaré au RNE — déclaratif officiel |
| `DETIENT` | INPI (acte) | `declared` | Cession/acquisition publiée |
| `DETIENT` | Indice du graphe (groupe + dirigeant commun) | `inferred` | Hypothèse à confirmer |
| `PARTAGE_ADRESSE` | Sirene siège | `declared` | Adresse déclarée à l'INSEE |
| `A_PUBLIE` | BODACC | `confirmed` | Publication officielle au journal des annonces |
| `EST_VISE_PAR` | DG Trésor (exact ID) | `declared` | Identifiant officiel du registre |
| `EST_VISE_PAR` | OpenSanctions match exact | `declared` | Identifiant officiel d'une liste agrégée |
| `EST_VISE_PAR` | OpenSanctions fuzzy (score 0.85+) | `simulated` | Rapprochement nominal — à vérifier |
| `EMPLOIE` | Tous | `inferred` | Information rare en open data |

Toute valeur peut être surchargée par l'objet `evidenceLevel` sur l'entité ou l'edge produit par un normalizer.

## Trail de provenance

Chaque entité, edge, événement et signal **doit pouvoir être tracé** jusqu'à la source brute.

### Schéma de la chaîne de preuve

```
┌───────────┐    ┌──────────┐    ┌──────────────┐
│  entity   │────│ evidence │────│ source_record│
│  / edge   │    │          │    │              │
│  / event  │    │ - level  │    │ - source     │
│  / signal │    │ - excerpt│    │ - endpoint   │
└───────────┘    │ - pointer│    │ - http_status│
                 └──────────┘    │ - payload    │
                                 │ - payload_hash (sha256)
                                 │ - is_fixture │
                                 └──────────────┘
```

| Champ | Rôle |
|---|---|
| `source_records.endpoint` | URL exacte appelée (ou `fixture:<nom>` en démo) |
| `source_records.payload` | JSON renvoyé verbatim |
| `source_records.payload_hash` | SHA-256 du payload — intégrité + dédup |
| `source_records.is_fixture` | `true` en démo / `false` en live |
| `evidence.subject_type` | `'entity' \| 'edge' \| 'event' \| 'risk_signal'` |
| `evidence.subject_id` | UUID du sujet dérivé |
| `evidence.excerpt` | Justification humainement lisible (« Dirigeant déclaré au RCS ») |
| `evidence.pointer` | Chemin JSON dans le payload pour la donnée exacte |

### Cycle de vie

1. **Ingestion** : connecteur fait l'appel → `ConnectorResult<TRaw>` contient le payload brut + endpoint + status.
2. **Normalisation** : `normalize-*` produit `entities`, `edges`, `events` typés.
3. **Persistance** : `assembleCase` agrège, persiste les `source_records` AVANT les entités (FK).
4. **Création des `evidence`** : un par entité/edge dérivé, pointant vers son `source_record`.
5. **Lecture** : `getCase` renvoie le `bundle` + la liste des `sources` (visible dans l'onglet Sources et exposé via `/api/export/json`).
6. **Export PDF** : `CaseReport` rend une annexe « Sources & provenance » avec endpoint + statut + origine.

### Sortie dans l'export JSON

L'export `/cases/[id]/export/json` produit un **manifeste d'audit** :

```json
{
  "generator": "KYB Graph",
  "generatedAt": "2026-06-01T19:00:00Z",
  "payloadHash": "9a3f...",
  "bundle": { "case": {...}, "entities": [...], "edges": [...], "events": [...], "riskSignals": [...] },
  "sources": [
    {
      "source": "sirene",
      "endpoint": "https://api.insee.fr/api-sirene/3.11/siren/552032534",
      "httpStatus": 200,
      "isFixture": false
    },
    ...
  ]
}
```

Le `payloadHash` permet de vérifier qu'un dossier exporté n'a pas été altéré entre deux exports. L'export `/cases/[id]/export/pack` produit en plus un **Evidence Pack ZIP** (rapport PDF + `report-data.json` + `audit-trail.json` + `verify.mjs`) vérifiable hors-ligne. Les deux acceptent `?redact=persons` (personnes masquées « Personne #N »).

## Journal de preuve (`audit_logs`, Étape 3.4)

Chaque action significative sur un dossier est journalisée en **append-only
hash-chaîné** (`src/lib/audit/`) : `dossier_cree`, `source_consultee` (avec
`payloadHash` corroborant `source_records.payload_hash`), `risque_calcule`,
`ecart_ubo_detecte` (comptes AMLR agrégés, jamais nominatifs — CJUE),
`synthese_enregistree` (empreinte + règles citées), `export_genere`.

Chaque entrée embarque le hash de la précédente (`prev_hash` → `entry_hash`,
genèse `0×64`) : altérer ou supprimer une entrée passée casse la chaîne —
`verifyChain` (et le `verify.mjs` embarqué dans l'Evidence Pack) le détecte.
En mode démo zéro-clé, le jumeau mémoire (`journalStore` + seeds
déterministes des fixtures) offre le même comportement sans BDD.

> **Deux sérialisations de hash coexistent volontairement** :
> - `source_records.payload_hash` et le `payloadHash` des exports utilisent la
>   convention historique `sha256(JSON.stringify(...))` (ordre d'insertion) —
>   inchangée pour ne pas invalider les empreintes déjà émises ;
> - la **chaîne du journal** hache une sérialisation **canonique** (clés triées
>   récursivement, `canonicalJson`) — indispensable au rejeu hors-ligne.

## Règles d'usage

| Règle | Justification |
|---|---|
| Un edge `inferred` ne peut pas alimenter un signal de risque sans une seconde source. | Évite les faux positifs dans `computeRisk`. |
| Un edge `simulated` n'est jamais persisté dans `evidence` comme `confirmed`. | Garde-fou produit. |
| L'export PDF / JSON inclut **tous** les niveaux de preuve avec leur badge. | Transparence vis-à-vis du destinataire. |
| Un dirigeant `simulated` (rapprochement OpenSanctions fuzzy) reste affiché derrière le badge « à vérifier ». | CJUE 2022 + bonne pratique. |
| Les routes auth-gatées (UBO, annotations) loggent l'action dans `audit_logs` (Étape 3.4). | Traçabilité réglementaire AMLR. |

## Évolutions prévues

- **Étape 3.4 (réalisé)** : journal `audit_logs` append-only hash-chaîné (cf. section ci-dessus). Restent : les **annotations** (besoin d'`actorId` → après l'auth Étape 2.2) et la **signature Ed25519** du manifeste d'export (gestion de clés à l'étape souveraineté — champ `signature: null` réservé dans le pack).
- **Étape 3** : Apache AGE → requêtes Cypher sur la chaîne de provenance (« quelle source a produit ce nœud ? », « tous les dossiers utilisant ce SIREN »).

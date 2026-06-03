# Architecture — KYB Graph

## Vue d'ensemble

```
┌─────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  Navigateur │──────┤  Next.js App Router  │──────┤   Repository     │
│  (Sigma     │      │  (RSC + Server       │      │   (Fixture ou Db │
│   WebGL)    │      │   Actions + Route    │      │   selon DATABASE │
└─────────────┘      │   Handlers)          │      │   _URL)          │
                     └──────────┬───────────┘      └─────┬────────────┘
                                │                        │
                                ▼                        ▼
                     ┌──────────────────────┐   ┌────────────────────┐
                     │  Connecteurs         │   │  Neon Postgres     │
                     │  (Sirene · BODACC ·  │   │  (Drizzle ORM,     │
                     │   INPI · DG Trésor · │   │   11 tables) ou    │
                     │   OpenSanctions)     │   │  in-memory store   │
                     └──────────┬───────────┘   └────────────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  assembleCase(siren) │
                     │  → bundle + sources  │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  buildGraph + risk   │
                     │  engine + scoring    │
                     │  (Graphology, pur)   │
                     └──────────────────────┘
```

## Stack

- **Frontend** : Next.js 16 (App Router, Turbopack, React Compiler) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui (17 primitives Radix vendorisées) · cmdk (⌘K) · motion (transitions) · next-themes (light/dark).
- **Graphe** : Sigma.js v3 (WebGL) · Graphology + extensions (layout-forceatlas2, communities-louvain, components, metrics, shortest-path).
- **Backend** : Server Actions + Route Handlers Node.js · Drizzle ORM · Neon serverless (HTTP). Synthèse IA : workflow manuel copier-coller via la session Claude Code de l'utilisateur (zéro appel API tiers, cf. `docs/regulatory.md`).
- **Sécurité/Obs** : Zod (validation) · token-bucket in-memory (rate limit, prêt pour Upstash) · Sentry (scaffold, no-op sans DSN) · @vercel/analytics + speed-insights.
- **Tests** : Vitest (29 tests unit) · Playwright (3 specs e2e) · GitHub Actions CI.

## Arborescence

```
src/
├─ app/
│  ├─ page.tsx                       Landing publique (hors shell)
│  ├─ layout.tsx                     Root layout (fonts, ThemeProvider, Analytics)
│  ├─ globals.css                    Tokens marque + couche shadcn (light/dark)
│  ├─ api/
│  │  ├─ search/route.ts             POST recherche société (Sirene + Zod + RL)
│  │  └─ cron/refresh/route.ts       Cron BODACC (gate CRON_SECRET)
│  └─ (app)/                         Shell applicatif (sidebar + topbar + ⌘K)
│     ├─ layout.tsx                  AppShell, charge cases pour ⌘K
│     ├─ dashboard/                  KPIs + dossiers récents
│     ├─ cases/
│     │  ├─ page.tsx                 Liste triable/filtrable
│     │  ├─ actions.ts               Server Actions (search, create)
│     │  ├─ new/page.tsx             Dialog création depuis SIREN
│     │  └─ [caseId]/                Workspace dossier
│     │     ├─ layout.tsx            En-tête + tabs + ExportMenu
│     │     ├─ graphe/               Vue Sigma WebGL
│     │     ├─ timeline/             Événements juridiques (BODACC)
│     │     ├─ risques/              Signaux de vigilance + Synthèse IA
│     │     ├─ sources/              Trail de provenance
│     │     ├─ analyse/              Métriques structurelles
│     │     ├─ export/{pdf,json}/    Routes export
│     │     └─ synthesis/route.ts    Streaming Claude
│     └─ reglages/                   Page Réglages
├─ components/
│  ├─ ui/                            shadcn primitives
│  ├─ shell/                         AppSidebar, TopBar, CommandPalette, ThemeToggle, PageMotion
│  ├─ cases/                         CasesTable, ScorePills, NewCaseDialog, RisksList, AiSynthesis, ExportMenu, KpiCard, WorkspaceTabs
│  ├─ graph/                         GraphScene (Sigma), GraphCanvas, GraphTable, GraphToolbar, NodePanel, EdgePanel, Legend, GraphTooltip, EvidenceBadge
│  ├─ reports/                       CaseReport (React-PDF)
│  └─ empty/                         EmptyState générique
└─ lib/
   ├─ env.ts                         Validation Zod des env vars (toutes optionnelles)
   ├─ siren.ts                       Validation SIREN/SIRET Luhn
   ├─ data/                          Repository seam (Fixture ↔ Db) + GraphQueryRepository
   ├─ db/                            Drizzle client + 11 tables schéma
   ├─ connectors/                    Sirene, BODACC, INPI, Trésor, OpenSanctions
   ├─ ingestion/                     normalize-* + assemble-case
   ├─ graph/                         build-graph, layout, serialize, algorithms (metrics + path)
   ├─ risk/                          types, rules (7), engine + scoring 3 axes
   ├─ store/                         Zustand graph store
   ├─ server/                        validate (Zod helper), rate-limit (token-bucket)
   └─ fixtures/                      5 dossiers démo + payloads bruts par connecteur
```

## Schéma de données (11 tables Drizzle)

| Table | Rôle |
|---|---|
| `cases` | Métadonnées dossier + 3 scores |
| `entities` | Nœuds polymorphes (company/person/address/event/sanction) |
| `companies` | Sous-table 1-1 entité société |
| `persons` | Sous-table 1-1 entité personne |
| `addresses` | Sous-table 1-1 entité adresse |
| `edges` | Liens typés avec niveau de preuve + poids + période |
| `events` | Timeline juridique (BODACC) |
| `evidence` | Lien sujet → source_record + niveau + justif. |
| `source_records` | Payload API brut + SHA-256 (chaîne de preuve) |
| `risk_signals` | Signaux calculés par règles (ruleId, sévérité, catégorie, explication) |
| `graph_snapshots` | Versionnage du graphe avec coords ForceAtlas2 + clusters |

Voir `drizzle/0000_sleepy_silver_surfer.sql` pour les colonnes exactes.

## Seams (couches d'abstraction)

### `CasesRepository` (`lib/data/cases-repository.ts`)
Interface pure : `listCases`, `getCase`, `searchCompanies`, `createCaseFromSiren`.
- Implémentation `FixtureCasesRepository` (fixtures + store mémoire) par défaut.
- Implémentation `DbCasesRepository` (Neon + Drizzle) si `DATABASE_URL` défini.
- L'UI ne dépend QUE de cette interface → migration BDD sans modif front.

### `GraphQueryRepository` (`lib/data/graph-query-repository.ts`)
Interface Cypher-shaped : `shortestPath`, `metrics`, `expandSubgraph`.
- `GraphologyQueryRepository` (in-memory) par défaut.
- `AgeCypherRepository` (stub) si `GRAPH_QUERY_BACKEND=age` → préparation Apache AGE souverain (cf. `sovereignty.md`).

## Pipeline `assembleCase(siren)`

1. Appel **Sirene** unité légale + établissement siège (mock fixture si pas de clé).
2. Appel **BODACC** (annonces par SIREN, sans clé).
3. Appel **INPI** RNE (live : login JWT → `/companies/{siren}` → transform dirigeants PP/PM + UBO ; fixture sans credentials). UBO gatés par `INPI_EXPOSE_UBO` (défaut off, CJUE 2022).
4. Appel **DG Trésor** gels (registre national).
5. Appel **OpenSanctions** match company (UE, listes agrégées).
6. **Normalisation** : chaque payload → entités + edges + events + evidence (`normalize-*`).
7. **Déduplication** par `natural_key`.
8. **Construction du graphe** Graphology (`buildGraph`).
9. **Risk engine** (`computeRisk`) : 7 règles + scoring 3 axes (complexité / vigilance / qualité de preuve).
10. Retour `{ bundle: CaseBundle, sources: SourceRecordInput[] }`.

## Garde-fous produit (non négociables)

1. **Niveau de preuve** sur tout node/edge/event/signal : `confirmed | declared | inferred | simulated`. `inferred`/`simulated` portent toujours « à vérifier ».
2. **Scores labellisés** complexité / vigilance / qualité de preuve. **Jamais « fraude »** (vérifié par grep + system prompt LLM).
3. **Mode démo zéro-clé** : l'app boote et affiche tout sans aucune clé API ni base de données.
4. **Traçabilité** : chaque payload API brut persisté dans `source_records` avec SHA-256.
5. **RGPD** : profilage de dirigeants ; en démo, fixtures anonymisées ; clés API serveur uniquement ; pas de scraping.

## Variables d'environnement

| Var | Effet | Sans elle |
|---|---|---|
| `DATABASE_URL` | Persistance Neon | FixtureCasesRepository en mémoire |
| `NEXT_PUBLIC_DEMO_MODE` | Mode démo | Défaut `true` (mock) |
| `INSEE_SIRENE_API_KEY` | Sirene live | Fixture |
| `BODACC_API_KEY` | Quota BODACC élevé | Quota standard |
| `INPI_USERNAME`/`PASSWORD` | RNE live (dirigeants + UBO) | Fixture |
| `INPI_EXPOSE_UBO` | Affiche les UBO réels dans le graphe | Défaut `false` (gating CJUE 2022) |
| `TRESOR_GELS_ENABLED` | DG Trésor live | Mock |
| `OPENSANCTIONS_API_KEY` | Quota élevé | Free tier |
| `SENTRY_DSN` | Sentry actif | No-op |
| `CRON_SECRET` | Cron BODACC sécurisé | Cron public refusé 401 |
| `GRAPH_QUERY_BACKEND=age` | AgeCypherRepository | Graphology in-memory |

Voir `.env.example` pour la liste exhaustive.

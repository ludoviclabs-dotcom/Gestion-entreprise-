# KYB Graph

**Cartographie de conformité.** Comprendre qui contrôle quoi, qui dirige quoi, qui paie qui — et avec quel niveau de preuve.

KYB Graph est un outil de _due diligence_ qui visualise les liens entre sociétés, dirigeants, SCI, adresses, événements juridiques et sanctions, avec un graphe interactif (Sigma.js + Graphology) et une trace de preuve complète.

> ⚠️ Le produit ne qualifie **jamais** une structure de « frauduleuse ». Il parle de **complexité, vigilance, qualité de preuve, lien prouvé / déclaré / inféré / simulé**.

---

## Démarrage rapide (mode démo, zéro clé)

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

L'application boote en **mode démo** : 5 dossiers de cartographie peuplés (holding + 2 SCI, société propre, procédure collective, réseau dense multi-dirigeants, brouillon). Aucun raccordement Neon ni clé API n'est requis.

## Stack

- **Next.js 16** (App Router · Turbopack · React Compiler) + **React 19** + **TypeScript strict**
- **Tailwind CSS v4** + **shadcn/ui** (primitives Radix), `motion/react` pour les transitions, `cmdk` pour la palette ⌘K
- **Sigma.js v3** + **Graphology** (rendu WebGL du graphe, ForceAtlas2 + Louvain côté serveur)
- **Neon Postgres** + **Drizzle ORM** (persistance, optionnelle)
- **Zod** (validation), **Zustand** (état client du graphe), **Vitest** + **Playwright**

## Architecture (résumé)

```
src/
├─ app/
│  ├─ page.tsx                    landing publique
│  └─ (app)/                      shell applicatif (sidebar + topbar + ⌘K)
│     ├─ dashboard/               KPIs + dossiers récents
│     ├─ cases/                   liste, création (Server Action)
│     └─ cases/[caseId]/          workspace 4 onglets-routes
│        ├─ graphe/               canvas Sigma plein écran + toolbar
│        ├─ timeline/             événements juridiques
│        ├─ risques/              signaux de vigilance
│        └─ sources/              trail de provenance
├─ components/
│  ├─ ui/                         primitives shadcn (Dialog, Table, Command…)
│  ├─ shell/                      AppSidebar, TopBar, CommandPalette, PageMotion
│  ├─ cases/                      ScorePills, CasesTable, NewCaseDialog, …
│  └─ graph/                      GraphScene, GraphCanvas, NodePanel, EdgePanel
└─ lib/
   ├─ data/                       couche repository (UI ↔ données)
   ├─ db/schema/                  schéma Drizzle (11 tables)
   ├─ connectors/                 Sirene · BODACC · INPI · DG Trésor
   ├─ ingestion/                  normalize-* + assemble-case
   ├─ graph/                      build-graph · layout · serialize
   └─ fixtures/                   5 dossiers de démonstration
```

### Couche repository — la couture clé

L'UI ne dépend que de l'interface `CasesRepository` (`src/lib/data/types.ts`). Deux implémentations interchangeables :

| Implémentation | Quand | Comment |
|---|---|---|
| `FixtureCasesRepository` | par défaut | Fixtures statiques + store mémoire en session |
| `DbCasesRepository` | si `DATABASE_URL` est défini | Neon Postgres via Drizzle |

Le sélecteur `getCasesRepository()` choisit automatiquement. **L'UI est inchangée.**

## Garde-fous produit (non négociables)

1. **Niveau de preuve** sur chaque node/edge/event/signal : `confirmed | declared | inferred | simulated`. `inferred`/`simulated` portent toujours un badge « à vérifier ».
2. **Scores labellisés** complexité / vigilance / qualité de preuve. **Jamais « fraude ».**
3. **Mode démo zéro-clé** : l'app boote et affiche tout sans aucune clé API ni base de données.
4. **Traçabilité** : chaque payload API brut est persisté dans `source_records` (chaîne de preuve).
5. **RGPD** : profilage de dirigeants → fixtures anonymisées en démo, clés API côté serveur uniquement, **API officielles** seulement (jamais de scraping).

---

## Raccordement à des données réelles

### Activer Neon (persistance)

1. Provisionner Neon Postgres (Vercel Marketplace → Neon, ou directement [neon.tech](https://neon.tech)).
2. Renseigner dans `.env.local` :
   ```
   DATABASE_URL=postgres://…-pooler…neon.tech/<db>?sslmode=require
   DATABASE_URL_UNPOOLED=postgres://…neon.tech/<db>?sslmode=require
   ```
3. Appliquer les migrations :
   ```bash
   npm run db:migrate
   ```
4. Relancer `npm run dev` — le sélecteur bascule sur `DbCasesRepository`.

Schéma : 11 tables (cases · entities · companies · persons · addresses · edges · events · evidence · source_records · risk_signals · graph_snapshots). Migration initiale : `drizzle/0000_sleepy_silver_surfer.sql`.

### Activer les connecteurs en live (open data)

Les connecteurs `Sirene`/`BODACC`/`INPI`/`DG Trésor — gels` ont déjà une **implémentation live** prête. Ils basculent automatiquement en fixtures si la clé/le flag est manquant.

- **INSEE Sirene** (gratuit avec compte, 30 req/min)
  1. Créer un compte sur [portail-api.insee.fr](https://portail-api.insee.fr/) → souscrire « API Sirene (V3.11) » → générer une clé.
  2. `.env.local` : `INSEE_SIRENE_API_KEY=…`
  3. Désactiver le mode démo : `NEXT_PUBLIC_DEMO_MODE=false`
- **BODACC** : sans clé. Une clé Opendatasoft optionnelle élève les quotas (`BODACC_API_KEY=…`).
- **INPI / RNE** : stub pour l'instant (login RNE hors périmètre v1).
- **DG Trésor — Registre national des gels** : API publique sans auth. Activer via `TRESOR_GELS_ENABLED=true`.

Voir `.env.example` pour la liste complète.

---

## Scripts npm

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build production |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (Vitest) |
| `npm run e2e` | Tests end-to-end (Playwright) |
| `npm run db:generate` | Génère une migration Drizzle |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:studio` | Drizzle Studio (UI BDD) |
| `npm run db:push` | Pousse le schéma sans migration (dev) |

## Vérification

```bash
npm test          # 20 tests verts
npm run build     # Build production réussit
npm run dev       # /dashboard accessible
```

## Licence

Privé — code propriétaire.

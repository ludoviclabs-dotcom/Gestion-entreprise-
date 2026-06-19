# Tutoriel — Connecter les sources réelles à KYB Graph

> Tous les connecteurs de KYB Graph sont **env-driven** : chaque variable d'env activée déverrouille sa fonctionnalité, **sans aucune modification de code**. Quand une variable manque, l'app retombe automatiquement sur le mode démo (fixtures). Tu peux activer les connecteurs **un par un, dans l'ordre qui te convient**.

## Ordre recommandé

L'ordre suivant maximise l'impact visible à chaque étape :

| # | Connecteur | Effet | Difficulté | Coût |
|---|---|---|---|---|
| 1 | **INSEE Sirene** | Recherche société live + identité réelle | ⭐ facile | gratuit |
| 2 | **Neon Postgres** | Persistance des dossiers créés | ⭐⭐ moyenne | gratuit (free tier) |
| 3 | **`db:migrate`** | Création des 11 tables | ⭐ facile | — |
| 4 | **Synthèse via Claude Code** | Aucune action requise — workflow copier-coller manuel | ⭐ facile | gratuit |
| 5 | **`CRON_SECRET`** | Sécurisation du cron BODACC | ⭐ facile | — |
| 6 | **DG Trésor gels** | Sanctions FR live (sans clé) | ⭐ facile | gratuit |
| 7 | **OpenSanctions** | Sanctions/PEP UE (optionnel) | ⭐ facile | gratuit |
| 8 | **BODACC** (clé) | Quotas élevés Opendatasoft | ⭐ facile | gratuit |
| 9 | **INPI / RNE** | Dirigeants + UBO réels | ⭐⭐⭐ complexe | gratuit |
| 10 | **Sentry** | Observabilité erreurs | ⭐ facile | gratuit (5k events/mois) |
| 11 | **GitHub → Vercel** | CI/CD auto | ⭐ facile | — |
| 12 | **`NEXT_PUBLIC_DEMO_MODE=false`** | Bascule en mode live | ⭐ facile | — |

---

## Préliminaires — où poser les variables

Toutes les variables d'environnement se posent à **deux endroits** :

### Côté production (Vercel)
1. <https://vercel.com/ludovics-projects-159c139c/kyb-graph/settings/environment-variables>
2. Pour chaque variable : **Add New** → entre la clé, la valeur, coche les 3 environnements (Production, Preview, Development) — ou seulement Production si tu veux que la démo reste sur fixtures.
3. **Redéploie** pour qu'elles prennent effet : sur la page Deployments → bouton ⋯ du dernier deploy → **Redeploy**, OU lance `vercel --prod --yes` depuis ta machine.

### Côté local (développement)
Crée le fichier `.env.local` à la racine de `C:\Users\Ludo\Gestion Entreprises` (s'il n'existe pas) et ajoute les variables au format `CLÉ=valeur`, une par ligne :

```dotenv
INSEE_SIRENE_API_KEY=ta_cle_ici
DATABASE_URL=postgres://...
```

Vercel ignore `.env.local` (déjà dans `.gitignore`). Pour synchroniser depuis Vercel vers ta machine : `vercel env pull .env.local`.

---

## 1️⃣ INSEE Sirene — la base de toute identité société

**Effet** : la recherche par nom ou SIREN devient **réelle** ; la création de dossier (Server Action) utilise les vrais référentiels INSEE pour l'unité légale + adresse du siège.

### Étape par étape

1. **Crée un compte** sur <https://portail-api.insee.fr/> (bouton « Inscription » en haut à droite). Mail + mot de passe, validation par mail.
2. Une fois connecté, dans le menu de gauche → **« Mes applications »** → **« Créer une application »**. Nom libre (ex. `KYB Graph`), description optionnelle.
3. Sur la fiche de l'application, onglet **« Souscriptions »** → bouton **« Souscrire à une API »** → choisis **« API Sirene »** (V3.11) → confirme.
4. Reviens sur l'onglet **« Détails »** de l'application → tu vois un champ **« Clé d'intégration »**. Clique **« Générer »** ou **« Afficher »** → copie la valeur (chaîne longue de ~64 caractères).

### Variable à poser

```dotenv
INSEE_SIRENE_API_KEY=ta_cle_d_integration_copiee
```

### Vérification

**En local** :
```bash
cd "C:\Users\Ludo\Gestion Entreprises"
npm run dev
# dans un autre terminal :
curl -X POST http://localhost:3000/api/search -H "Content-Type: application/json" -d '{"q":"Danone"}'
# La réponse doit contenir "source":"sirene" (pas "demo").
```

**En prod** : depuis le dashboard, lance une nouvelle recherche dans le dialog « Nouveau dossier » — la réponse réseau (DevTools → onglet Network → la requête `searchCompaniesAction`) doit ramener des résultats réels (essaie un SIREN obscure).

### Quotas

- **30 req/min** côté gratuit. Le rate limiter intégré (`lib/connectors/http.ts:RateLimiter(28, 60_000)`) plafonne à 28 pour garder de la marge.
- Au-delà : payant, mais inutile pour un usage humain (KYB analyste).

### Gotcha

- Le header utilisé par le code est **`X-INSEE-Api-Key-Integration`**. Vérifie que la casse correspond exactement à ce que le portail t'indique (l'API a été migrée de l'ancien OAuth `api.insee.fr` vers `portail-api.insee.fr` mi-2025).

---

## 2️⃣ Neon Postgres — persistance des dossiers

**Effet** : les dossiers créés via « Nouveau dossier » survivent aux redéploiements. Le sélecteur `getCasesRepository()` bascule automatiquement vers `DbCasesRepository` dès que `DATABASE_URL` est défini.

### Étape par étape — via Vercel Marketplace (recommandé)

1. Va sur ton dashboard Vercel : <https://vercel.com/ludovics-projects-159c139c/kyb-graph>.
2. Onglet **« Storage »** → **« Create Database »** → choisis **Neon**.
3. Sélectionne la région **Frankfurt (eu-central-1)** (UE, latence proche).
4. Clique **« Continue »** → confirme. Vercel crée la BDD et **injecte automatiquement** dans le projet :
   - `DATABASE_URL` (URL poolée — pour le driver neon-http)
   - `DATABASE_URL_UNPOOLED` (URL directe — pour les migrations + transactions)
   - et quelques alias (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, etc.) qu'on n'utilise pas.

### Étape par étape — sans Vercel Marketplace (alternative)

1. Crée un compte sur <https://neon.tech>.
2. Bouton **« New Project »** → région Frankfurt → version Postgres 17 → nom `kyb-graph` → **Create**.
3. Sur le dashboard du projet → onglet **« Connection Details »**.
4. Bascule en haut sur **« Pooled connection »** → copie l'URL → c'est ton `DATABASE_URL`.
5. Bascule sur **« Direct connection »** → copie → c'est ton `DATABASE_URL_UNPOOLED`.
6. Pose les deux dans Vercel **et** dans `.env.local`.

### Variables à poser

```dotenv
DATABASE_URL=postgres://USER:PASSWORD@ep-xxxx-pooler.eu-central-1.aws.neon.tech/kyb?sslmode=require
DATABASE_URL_UNPOOLED=postgres://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/kyb?sslmode=require
```

### Vérification

```bash
cd "C:\Users\Ludo\Gestion Entreprises"
npm run db:studio
```

Drizzle Studio s'ouvre dans le navigateur sur `https://local.drizzle.studio` → tu dois voir la connexion réussie (mais aucune table tant que les migrations ne sont pas passées — étape 3).

### Quotas (free tier)

- **3 Go** de stockage.
- **191 h-CPU compute/mois**.
- Largement suffisant pour 100+ dossiers réels.

---

## 3️⃣ Appliquer les migrations Drizzle

**Effet** : crée les **11 tables** dans Neon (`cases`, `entities`, `companies`, `persons`, `addresses`, `edges`, `events`, `evidence`, `source_records`, `risk_signals`, `graph_snapshots`) à partir de `drizzle/0000_sleepy_silver_surfer.sql`.

### Commande

```bash
cd "C:\Users\Ludo\Gestion Entreprises"
# Assure-toi que .env.local contient DATABASE_URL
npm run db:migrate
```

Sortie attendue :
```
Reading config file 'drizzle.config.ts'
Migrations applied successfully ✓
```

### Vérification

```bash
npm run db:studio
```

Tu dois voir les 11 tables (vides) dans le panneau de gauche. Ouvre `cases` → 0 row.

### Optionnel — seed initial

Si tu veux que ta prod ne démarre pas vide, tu peux soit :
- **Créer un dossier de test** via l'UI une fois la clé INSEE Sirene posée.
- Écrire un script `scripts/seed-fixtures.ts` qui pousse les 5 fixtures de démo dans la BDD (non livré aujourd'hui, prévu en option Étape 2.1).

---

## 4️⃣ Synthèse via Claude Code — aucune action requise

**Effet** : le bouton « Préparer un briefing » dans l'onglet **Risques** d'un dossier ouvre une fenêtre avec un briefing Markdown (système prompt + données du dossier). Tu le colles dans ta session Claude Code, tu récupères la synthèse, tu la colles dans la zone prévue, tu enregistres. La synthèse est ensuite persistée dans Neon et s'affiche à chaque visite du dossier.

> 🆓 **Pas de clé API, pas de frais** : tout passe par ton abonnement Claude Code existant. La route serveur `/api/cases/[caseId]/synthesis` a été supprimée (commit dans l'historique git si tu veux la restaurer un jour).

### Variable à poser

**Aucune.**

### Workflow utilisateur

1. Ouvre un dossier → onglet **Risques** → clique **« Préparer un briefing »**.
2. Dans la `Dialog`, clique **« Copier le briefing »** (toast de confirmation).
3. Bascule sur ta session Claude Code, colle le briefing → Claude génère la synthèse (250 mots max, vocabulaire imposé, jamais « fraude »).
4. Copie la réponse, retourne sur la `Dialog`, colle dans la zone du bas.
5. Clique **Enregistrer** → la synthèse est persistée et affichée immédiatement.
6. À la prochaine visite du dossier, elle s'affiche directement avec sa date. Bouton **Régénérer** pour l'écraser.

### Garde-fous

- Le briefing contient un **système prompt strict** (interdiction « fraude », vocabulaire imposé, structure en 3 parties, 250 mots max) — c'est ce qui garantit que Claude Code respecte les mêmes règles que l'auto-génération API aurait respectées.
- Le prompt est défini dans `src/lib/synthesis/briefing.ts:SYNTHESIS_SYSTEM_PROMPT`. Ne le modifie pas sans relire `docs/regulatory.md`.
- Validation Zod côté serveur : 20 < contenu < 5000 caractères.

---

## 5️⃣ Sécuriser le cron BODACC

**Effet** : le cron Vercel quotidien (7h UTC) sur `/api/cron/refresh` ne peut être déclenché que par Vercel lui-même grâce à un secret partagé.

### Génération du secret

```bash
# Sous PowerShell ou WSL :
openssl rand -hex 32
# Output exemple : 9a3f...b2c1 (64 caractères hex)
```

Ou bien en pur PowerShell :
```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

### Variable à poser

```dotenv
CRON_SECRET=9a3f...b2c1
```

### Vérification

- En prod, le cron tourne chaque jour à 7h UTC. Tu peux le vérifier dans **Vercel → projet kyb-graph → Logs** : filtre sur `/api/cron/refresh`.
- Pour le tester manuellement (sans attendre 24 h) :
  ```bash
  curl -i -H "Authorization: Bearer 9a3f...b2c1" https://kyb-graph.vercel.app/api/cron/refresh
  ```
  Doit renvoyer un récap JSON. Sans le header → 401.

---

## 6️⃣ DG Trésor — Registre national des gels

**Effet** : matching des dirigeants/sociétés contre le registre national des gels d'avoirs publié par la DG Trésor.

### Variable à poser

Aucune clé requise — c'est une API publique. Juste un flag d'activation :

```dotenv
TRESOR_GELS_ENABLED=true
```

### Quotas

- API publique sans authentification.
- Pas de quota documenté ; bon sens : ne pas mitrailler.

### Vérification

Sans flag → le connecteur renvoie la fixture. Avec flag → il fait `GET https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-flux-json` et matche en mémoire.

---

## 7️⃣ OpenSanctions — sanctions/PEP UE (optionnel)

**Effet** : agrégat UE de centaines de listes sanctions + PEP (politiques exposés). Match nominatif + ID exact.

### Étape par étape

1. Va sur <https://www.opensanctions.org>.
2. Bouton **« Sign up »** → mail + mot de passe.
3. Connecte-toi → menu utilisateur → **API access**.
4. Bouton **« Create API key »** → copie.

Le free tier suffit pour quelques milliers de matches/mois.

### Variable à poser

```dotenv
OPENSANCTIONS_API_KEY=ta_cle_opensanctions
```

### Sans clé

Le code utilise le **free tier** anonyme (quotas plus faibles) avec un fallback fixture si rate-limited. Tu n'es pas obligé de poser la clé si tu fais un usage léger.

### Vérification

Crée un dossier sur un SIREN connu pour avoir un dirigeant homonyme d'une PEP — un signal `sanctions` doit apparaître avec evidence `simulated` ou `declared` selon le score.

---

## 8️⃣ BODACC — quota élevé (optionnel)

**Effet** : déjà fonctionnel sans clé. Une clé Opendatasoft te donne des quotas plus généreux.

### Étape par étape (si besoin)

1. Va sur <https://bodacc-datadila.opendatasoft.com>.
2. **Sign up** → mail.
3. Menu utilisateur → **API Keys** → **Create**.

### Variable à poser

```dotenv
BODACC_API_KEY=ta_cle_bodacc_opendatasoft
```

### Sans clé

Le connecteur utilise le quota anonyme, suffisant pour un usage modéré (< 100 requêtes/h).

---

## 9️⃣ INPI / RNE — dirigeants + UBO

**Effet** : récupère les dirigeants déclarés au Registre National des Entreprises et les bénéficiaires effectifs (UBO). C'est la pièce manquante pour avoir un graphe complet.

> ⚠️ **Sensibilité juridique** : l'arrêt CJUE du 22 novembre 2022 (C-37/20 et C-601/20) restreint l'accès public aux UBO. Affichage **uniquement** derrière auth + intérêt légitime documenté. Voir `docs/regulatory.md`.

### Étape par étape

1. Va sur <https://data.inpi.fr>.
2. Bouton **« S'inscrire »** → formulaire (Nom + organisme + finalité + mail + mot de passe).
3. L'INPI valide le compte sous 1 à 5 jours ouvrés (vérification de la finalité, surtout pour les UBO).
4. Une fois validé, connecte-toi → menu profil → **« Mes API »** → bouton **« Demander un accès »** → choisis l'API souhaitée (Companies / RBE) → coche les CGU.
5. Tu reçois un **username** et un **password** dédiés à l'API (pas tes credentials de connexion web).

### Variables à poser

```dotenv
INPI_USERNAME=ton_username_inpi_api
INPI_PASSWORD=ton_password_inpi_api
```

### État actuel du code

> ✅ **L'implémentation live d'INPI est complète** (`src/lib/connectors/inpi.ts`) : login `POST /sso/login` → JWT (caché ~50 min) → `GET /companies/{siren}` → transformation de la réponse RNE imbriquée (`src/lib/connectors/inpi-transform.ts`) vers dirigeants (personnes physiques **et** morales) + bénéficiaires effectifs. Dès que `INPI_USERNAME` + `INPI_PASSWORD` sont posés **et** `NEXT_PUBLIC_DEMO_MODE=false`, le connecteur tape l'API réelle. Sans credentials → fixture. En cas d'erreur API → résultat vide + capture Sentry (jamais la fixture DANONE, qui serait fausse pour un autre SIREN).

> ⚠️ **Le transform `inpi-transform.ts` est basé sur la structure documentée de l'API RNE** mais n'a pas encore été validé contre des réponses réelles (compte INPI en cours de validation). Il est ultra-défensif (ne lève jamais) et couvert par un test unitaire (`src/tests/unit/inpi-transform.spec.ts`). À confronter à de vraies réponses dès que les credentials sont actifs.

### ⚠️ Bénéficiaires effectifs (UBO) — gating CJUE 2022

Le connecteur **récupère** les UBO, mais `normalizeInpi` ne les **affiche dans le graphe que si** `INPI_EXPOSE_UBO=true`. Par défaut (`false`), les UBO réels ne sont **pas** rendus, conformément à l'arrêt CJUE du 22/11/2022 qui conditionne leur accès à un intérêt légitime documenté. **Ne passe `INPI_EXPOSE_UBO=true` qu'une fois l'auth (Étape 2.2) + le log d'intérêt légitime (Étape 3.4) en place.** Voir `docs/regulatory.md`.

```dotenv
# À n'activer qu'après mise en place de l'auth + log d'intérêt légitime :
INPI_EXPOSE_UBO=false
```

### Coût

- API gratuite.
- Quotas standards (quelques centaines de requêtes/jour) — largement suffisant pour KYB humain.

---

## 9️⃣ bis · GLEIF / LEI — sociétés mères transfrontalières (optionnel)

**Effet** : à partir du SIREN, retrouve le **LEI** du sujet (référentiel mondial GLEIF) et ses **sociétés mères de consolidation** (mère directe + mère ultime, niveau 2). Enrichit le nœud société racine d'un attribut `LEI` et ajoute les mères transfrontalières au graphe (arêtes `DETIENT` **structurelles**).

> ⚠️ GLEIF publie des relations de **consolidation comptable, sans pourcentage**. Les arêtes issues de GLEIF n'ont donc pas de `%` exploitable : elles enrichissent la **structure** du graphe et les règles structurelles (boucles, centralité), mais ne pèsent pas dans la cascade `computeUbo`. C'est cohérent et honnête : « A est consolidée par B », sans participation chiffrée déclarée.

### Variable à poser

Aucune clé requise — API ouverte (licence **CC0**). Juste un flag d'activation :

```dotenv
GLEIF_ENABLED=true
```

### Sans flag

Le connecteur renvoie la fixture (LEI DANONE, sans mère). Avec le flag **et** `NEXT_PUBLIC_DEMO_MODE=false`, il interroge `https://api.gleif.org/api/v1` : recherche par `entity.registeredAs=<siren>`, puis `direct-parent` / `ultimate-parent`. SIREN sans LEI (cas fréquent des PME) → résultat vide silencieux.

### Quotas

- API publique sans authentification, quotas généreux. Le rate limiter intégré plafonne à 50 req/min.

---

## 9️⃣ ter · VIES — validation TVA intracommunautaire (optionnel)

**Effet** : dérive le n° de TVA intracommunautaire français du SIREN (clé = `(12 + 3·(SIREN mod 97)) mod 97`) et le **valide** auprès de VIES (Commission UE). Enrichit le nœud société racine des attributs `TVA intracommunautaire` + `Statut TVA (VIES)`. Une TVA **active** ajoute un **facteur atténuant** (corroboration d'identité).

> ⚠️ **Validation, pas détection.** Un statut `inactive` n'est **pas** un signal de risque : beaucoup de PME purement domestiques ne sont pas enregistrées à la TVA intracommunautaire. La détection de carrousel (T2) relève de la couche transactionnelle, pas de ce connecteur.

> On appelle **VIES directement** : `api-entreprise` ne fait que l'encapsuler et reste réservée aux administrations.

### Variable à poser

Aucune clé requise — API REST publique. Juste un flag d'activation :

```dotenv
VIES_ENABLED=true
```

### Sans flag

Le connecteur renvoie la fixture. Avec le flag **et** `NEXT_PUBLIC_DEMO_MODE=false`, il interroge `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/FR/vat/<num>`. SIREN non dérivable / API indisponible → statut `indéterminée` (jamais une fausse alerte).

---

## 9️⃣ quater · BAN — normalisation d'adresse & domiciliation (optionnel)

**Effet** : normalise/géocode l'adresse du siège via la **Base Adresse Nationale**. Le nœud `Adresse` est alors keyé sur l'**identifiant BAN canonique** (`ad:ban:<id>`) + coordonnées. C'est ce qui rend le **clustering de domiciliation fiable** : deux sociétés au même lieu partagent le même nœud, même si Sirene écrit « 17 BD HAUSSMANN » d'un côté et « 17 boulevard Haussmann » de l'autre. Les règles `ADRESSE_PARTAGEE` et `CONCENTRATION_DOMICILIATION` (déjà présentes) deviennent exploitables.

> Repli : si le géocodage n'est pas confiant (score < 0,5) ou que BAN est indisponible, on retombe sur le slug du libellé Sirene (comportement historique). Aucune régression.

### Variable à poser

Aucune clé requise — API publique. Juste un flag d'activation :

```dotenv
BAN_ENABLED=true
```

### Sans flag

Le connecteur renvoie la fixture. Avec le flag **et** `NEXT_PUBLIC_DEMO_MODE=false`, il interroge `https://api-adresse.data.gouv.fr/search/?q=<adresse>&limit=1`.

---

## 🔟 Sentry — observabilité

**Effet** : capture les erreurs front + serveur en prod (stack traces, breadcrumbs, contexte requête). Sans Sentry, une erreur 500 reste invisible.

### Étape par étape

1. Crée un compte sur <https://sentry.io>.
2. **Create project** → choisis **Next.js** → région **Frankfurt** (UE).
3. Donne un nom : `kyb-graph`.
4. À l'étape « Install », Sentry te montre un **DSN** de la forme `https://abc123@o12345.ingest.de.sentry.io/67890`. Copie-le.

> ⚠️ **N'exécute PAS le wizard** `npx @sentry/wizard` que Sentry propose sur l'écran d'onboarding. Le projet a déjà toute la config Sentry câblée à la main (instrumentation + `beforeSend` scrubber RGPD). Le wizard écraserait ces fichiers. Tu n'as **que le DSN** à récupérer. L'écran « Set up the Sentry SDK » est juste l'état vide ; il se transforme en feed d'issues dès le premier event reçu.

### Variable à poser

```dotenv
SENTRY_DSN=https://abc123@o12345.ingest.de.sentry.io/67890
```

Scope **Production uniquement**, **Sensitive ON**. Puis **redéploie** (`vercel --prod --yes`) — la variable n'est lue qu'au boot du runtime.

### Vérification

Une fois la variable posée et l'app redéployée :
1. Déclenche une erreur volontaire (par exemple va sur une URL inexistante : `https://kyb-graph.vercel.app/cases/nimporte-quoi/graphe`).
2. Va sur le dashboard Sentry → tu dois voir l'erreur sous 30 secondes.

> 💡 Si le code gère proprement l'erreur (retourne 404/400 sans throw), Sentry ne capture rien — c'est normal. Pour un test garanti, crée temporairement une route `src/app/api/debug/sentry-test/route.ts` qui `throw new Error(...)`, déploie, `curl` la route, vérifie l'issue, puis **supprime la route**.

### ⚠️ Piège #1 — `instrumentation.ts` doit être DANS `src/`

**Symptôme** : `SENTRY_DSN` est bien posé, la route throw bien un 500, mais **aucune issue n'arrive dans Sentry**. Diagnostic : `Sentry.getClient()` renvoie `undefined` (`hasClient: false`) → `Sentry.init()` n'a jamais tourné → `captureException` est un no-op silencieux.

**Cause** : ce projet utilise un dossier **`src/`**. Next.js n'exécute le hook `register()` de `instrumentation.ts` **que si le fichier est dans `src/`** (pas à la racine). À la racine, il est ignoré sans erreur.

**Emplacement correct** (tous dans `src/`) :
```
src/instrumentation.ts          ← hook register() + onRequestError
src/instrumentation-client.ts   ← Sentry.init côté navigateur
src/sentry.server.config.ts     ← Sentry.init Node + beforeSend RGPD
src/sentry.edge.config.ts       ← Sentry.init Edge
```

### ⚠️ Piège #2 — `next.config.ts` doit être wrappé

`next.config.ts` doit exporter `withSentryConfig(config, {...})` depuis `@sentry/nextjs`, sinon l'auto-instrumentation (Server Actions, RSC) n'est pas câblée. Au build tu dois voir la ligne `[@sentry/nextjs - After Production Compile] Info: Sending telemetry...` — c'est la preuve que le wrap est actif.

### Garde-fou RGPD

Le code `src/sentry.server.config.ts` contient un **`beforeSend`** qui retire le champ `payload` des `source_records` avant envoi → pas de données personnelles brutes envoyées à Sentry SaaS US.

Pour une posture pleinement souveraine, voir `docs/sovereignty.md` (alternative GlitchTip self-hosted).

### Coût

- Free tier : **5000 events/mois**, **30 jours de rétention**. Largement suffisant pour démarrer.

---

## 1️⃣1️⃣ Lier GitHub → Vercel (CI/CD auto)

**Effet** : chaque `git push origin main` redéploie automatiquement en production. Chaque PR a son URL preview. La CI GitHub (`.github/workflows/ci.yml`) valide lint + typecheck + tests avant que Vercel déploie.

### Étape par étape

1. Va sur <https://vercel.com/ludovics-projects-159c139c/kyb-graph/settings/git>.
2. Section **« Connected Git Repository »** → bouton **« Connect Git Repository »**.
3. Choisis **GitHub** → autorise Vercel à accéder à ton compte (déjà fait si tu utilises déjà GitHub avec Vercel).
4. Cherche le repo `ludoviclabs-dotcom/Gestion-entreprise-` → clique.
5. Vercel propose une **Production Branch** : laisse `main`.
6. **Save**.

### Vérification

1. Fais un petit changement local (par exemple corriger un typo dans `README.md`).
2. `git add -A && git commit -m "chore: typo" && git push`.
3. Va sur l'onglet **Deployments** de Vercel → un nouveau deploy apparaît automatiquement.

### Fini les `vercel --prod` manuels

À partir de maintenant, la commande `vercel --prod --yes` n'est plus nécessaire — chaque push sur `main` déploie tout seul.

---

## 1️⃣2️⃣ Basculer en mode live

**Effet** : `NEXT_PUBLIC_DEMO_MODE=false` désactive **tous** les replis fixture. Les connecteurs taperont **uniquement** les vraies API.

### Recommandation

Active ce flag **uniquement en production**, et **après avoir vérifié** que toutes les clés API live fonctionnent. Garde la valeur sur `true` (ou non définie) en **Development** et **Preview** pour préserver les démos publiques sur fixtures.

### Variable à poser

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
```

Sur Vercel : pose la variable, mais **décoche** Preview et Development pour qu'elle ne s'applique qu'à Production.

### Vérification

Sur la prod : la création d'un dossier `999999998` (SIREN bidon mais Luhn valide) doit échouer avec une erreur Sirene 404 (pas retourner la fixture DANONE comme avant).

---

## 🧪 Vérification globale

Une fois les principales variables posées, voici comment t'assurer que tout marche :

### 1. Test Sirene live
```bash
curl -X POST https://kyb-graph.vercel.app/api/search \
  -H "Content-Type: application/json" \
  -d '{"q":"552032534"}'
# La réponse doit contenir "source":"sirene".
```

### 2. Test création réelle
1. Ouvre <https://kyb-graph.vercel.app/cases/new>.
2. Tape `552032534` (DANONE) → **Rechercher** → choisis le candidat.
3. Tu dois être redirigé vers `/cases/<id-aleatoire>/graphe` avec un graphe réel.
4. Vérifie l'onglet **Sources** : `isFixture` doit être `false`.

### 3. Test persistance
1. Crée un dossier comme ci-dessus.
2. Note l'`id` dans l'URL.
3. Attends 1 minute (pour qu'une nouvelle invocation serverless démarre potentiellement).
4. Va sur `/cases` → le dossier doit toujours être listé.
5. Clique → il s'ouvre normalement.

### 4. Test synthèse IA
1. Sur n'importe quel dossier → onglet **Risques** → bouton **Générer la synthèse**.
2. Le texte doit apparaître en streaming en quelques secondes.

### 5. Test cron
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://kyb-graph.vercel.app/api/cron/refresh
```

---

## 🐛 Troubleshooting

### « 401 Unauthorized » sur Sirene
- Vérifie que la clé est bien copiée (pas d'espace en début ou fin).
- Vérifie le header `X-INSEE-Api-Key-Integration` (casse exacte) — c'est défini dans `src/lib/connectors/sirene.ts:11`. Si l'INSEE a changé la casse depuis ce code, modifie cette constante.

### Drizzle migrate « Database does not exist »
- Vérifie que `DATABASE_URL_UNPOOLED` pointe vers la **base** existante (le path après `/` dans l'URL). Si tu as nommé ta base `kyb-graph` mais l'URL contient `/neondb`, corrige.

### Synthèse — la zone réponse n'enregistre pas
- Vérifie que la réponse fait au moins 20 caractères (validation Zod côté serveur).
- En cas d'erreur réseau, ouvre Vercel → Logs → cherche `saveSynthesisAction` pour le détail.

### Cron BODACC 401 alors que tu as posé `CRON_SECRET`
- La variable n'a pas le bon scope (Production/Preview/Development). Vérifie sur Vercel → Settings → Environment Variables.
- Le client (toi en `curl` ou le bouton Vercel) doit envoyer `Authorization: Bearer <secret>` exactement comme le code l'attend (`src/app/api/cron/refresh/route.ts`).

### Le déploiement ne se relance pas après ajout d'une variable
- C'est normal : Vercel ne redéploie pas tout seul quand tu **ajoutes** une variable d'env. Va sur **Deployments** → ⋯ sur le dernier → **Redeploy** (sans cocher « Use existing build cache », pour s'assurer que les vars sont réinjectées).

### J'ai mis ma clé et l'app utilise toujours la fixture
- Probable : `NEXT_PUBLIC_DEMO_MODE` est resté à `true` (ou n'est pas défini à `false`). Le code privilégie le mode démo tant qu'il n'est pas explicitement désactivé. Pose `NEXT_PUBLIC_DEMO_MODE=false`.
- Variante : ton scope Vercel a la variable seulement en Preview. Vérifie qu'elle est aussi cochée en Production.

---

## 📋 Récap des variables — tableau de référence

| Variable | Effet | Obligatoire pour | Comment l'obtenir |
|---|---|---|---|
| `INSEE_SIRENE_API_KEY` | Sirene live | Étape 1.2 | portail-api.insee.fr |
| `BODACC_API_KEY` | Quotas BODACC élevés | optionnel | bodacc-datadila.opendatasoft.com |
| `INPI_USERNAME`/`PASSWORD` | INPI dirigeants + UBO (live) | optionnel | data.inpi.fr |
| `INPI_EXPOSE_UBO=true` | Affiche les UBO réels (après auth + log) | optionnel, défaut off | flag (CJUE) |
| `TRESOR_GELS_ENABLED=true` | DG Trésor live | optionnel | flag |
| `OPENSANCTIONS_API_KEY` | Quotas OpenSanctions | optionnel | opensanctions.org |
| `GLEIF_ENABLED=true` | Sociétés mères transfrontalières (LEI) | optionnel | flag |
| `VIES_ENABLED=true` | Validation TVA intracommunautaire | optionnel | flag |
| `BAN_ENABLED=true` | Normalisation/géocodage des adresses | optionnel | flag |
| `DATABASE_URL` | Persistance Neon | Étape 2.1 | Vercel Marketplace ou neon.tech |
| `DATABASE_URL_UNPOOLED` | Migrations + transactions | Étape 2.1 | idem |
| `SENTRY_DSN` | Observabilité | Étape 1.5 | sentry.io |
| `CRON_SECRET` | Cron BODACC sécurisé | Étape 3.7 | `openssl rand -hex 32` |
| `NEXT_PUBLIC_DEMO_MODE=false` | Bascule live | obligatoire à la fin | flag |
| `GRAPH_QUERY_BACKEND=age` | Apache AGE | Étape 3 souveraine | flag (futur) |

---

## 🎯 Ordre de priorité d'attaque

Si tu n'as qu'un soir, fais dans cet ordre :

1. **15 min** : INSEE Sirene (étape 1) → recherche société live ✓
2. **15 min** : Neon Postgres (étape 2) + db:migrate (étape 3) → persistance ✓
3. **5 min** : `NEXT_PUBLIC_DEMO_MODE=false` (étape 12) + redéploie → bascule live ✓

Tu as alors une démo industrielle fonctionnelle minimale. Le reste peut suivre par lots.

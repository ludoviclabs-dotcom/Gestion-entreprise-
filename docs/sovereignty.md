# Souveraineté — feuille de route SecNumCloud

> Statut actuel : démos publiques sur Vercel (US, CLOUD Act), sur **données fictives anonymisées**. Acceptable pour la démo. **Disqualifiant** pour des données réelles relevant de Tracfin / ACPR / DGSI / DINUM.

## Cadre réglementaire et doctrinal

- **Doctrine « Cloud au centre »** (DINUM, circulaire du Premier ministre, 5 juillet 2021) : pour les administrations, les données sensibles doivent être hébergées sur des solutions cloud souveraines.
- **Qualification SecNumCloud 3.2** (ANSSI, 2023) : impose hébergement UE, immunité aux lois extraterritoriales (CLOUD Act, FISA), capitaux européens majoritaires, audit ANSSI annuel.
- **Règlement (UE) 2024/1624 — AMLR** (single rulebook anti-blanchiment) : directement applicable au **10 juillet 2027**. Seuil bénéficiaire effectif fixé à 25 %, signalement des divergences de registre sous 14 jours.
- **AMLA** — Autorité européenne de lutte contre le blanchiment ((UE) 2024/1620, siège Francfort) : opérationnelle depuis mi-2025, supervision directe à compter de 2028.
- **CJUE 22 novembre 2022, affaires C-37/20 et C-601/20** (WM / Sovim) : invalide la publicité du registre des bénéficiaires effectifs → accès conditionné à l'**intérêt légitime**. Conséquence dans KYB Graph : accès aux UBO derrière auth + log d'intérêt légitime documenté.
- **Tracfin 2024** : 211 165 déclarations de soupçon (+13,2 %). Marché en croissance soutenue.

## Fournisseurs SecNumCloud qualifiés (mai 2026)

| Fournisseur | Datacenters | Notes |
|---|---|---|
| **OVHcloud** | Gravelines, Roubaix, Strasbourg | Pure player FR, base de prix la plus large |
| **Outscale** (groupe Dassault) | Saint-Cloud | Filiale française, intégration Dassault Systèmes |
| **Scaleway** (groupe Iliad) | Paris, Amsterdam | Catalogue moderne (managed Postgres, K8s) |
| **Numspot** | France | Joint-venture Bouygues/Docaposte/Dassault/Cloud Temple |
| **Cloud Temple** | France | Filiale Thales/SCC, marché de la défense |

## Composants KYB Graph et cible souveraine

| Composant | Aujourd'hui (Vercel/Neon) | Cible SecNumCloud |
|---|---|---|
| Frontend Next.js | Vercel (US) | Self-hosting Docker (Coolify/Dokploy) sur OVHcloud Public Cloud Compute |
| API / Server Actions | Vercel Functions | Idem, conteneurisé |
| Postgres | Neon (AWS/EU) | OVHcloud Public Cloud Database Postgres 17, ou Scaleway Managed PostgreSQL |
| Graph queries | Drizzle in-memory + Graphology | **Postgres + Apache AGE 1.5+** (extension openCypher) — interface `GraphQueryRepository` déjà en place pour bascule |
| Sentry | Sentry SaaS (US) | **GlitchTip** self-hosted (compatible SDK Sentry) ou Sentry on-prem EU |
| Auth (Étape 2.2) | Better-Auth + Drizzle | Idem, hébergé EU |
| Sanctions/PEP | OpenSanctions (UE) | ✅ Déjà souverain |
| Sirene / BODACC / INPI / DG Trésor | API gouv. françaises | ✅ Déjà souverain |
| LLM (synthèse) | Anthropic Claude (US) | Mistral Large 2 hébergé via Scaleway AI Inference, ou OVHcloud AI Endpoints |

## Jalons de migration

| Trigger | Action |
|---|---|
| Démo publique sur fixtures | Statut actuel — Vercel acceptable. |
| **Premier prospect institutionnel concret** | Provisionner Neon EU + activer connecteurs live. |
| Pilote sous accord de confidentialité | Migrer la BDD vers OVHcloud Postgres EU + activer Apache AGE. Migrer Sentry vers GlitchTip. |
| Contrat signé Tracfin / ACPR / CAC 40 | Migration complète Frontend + API hors Vercel. Substituer Anthropic par Mistral souverain. Audit ANSSI préalable. |

## Pistes d'implémentation (commandes)

```bash
# Postgres + Apache AGE sur OVHcloud (à terme)
# 1. Postgres managé (cible EU) :
ovh-cloud-db postgres create kyb-graph --region GRA --version 17

# 2. Apache AGE :
# Note : la version managée d'OVHcloud n'expose pas AGE en standard.
# Alternative : Postgres autohébergé sur VM Public Cloud :
docker run -d --name kyb-postgres \
  -e POSTGRES_PASSWORD=… \
  -p 5432:5432 \
  apache/age:latest

# 3. Variables d'env à poser :
DATABASE_URL=postgres://...ovh.cloud.../kyb
GRAPH_QUERY_BACKEND=age   # bascule le sélecteur de GraphQueryRepository
```

## Annexe — décisions hors scope explicite

- **Sentry → GlitchTip** : pas urgent tant qu'aucune donnée personnelle réelle n'est traitée. Configurer `beforeSend` côté Sentry pour scrubber agressivement les payloads (déjà câblé dans `sentry.server.config.ts`).
- **Hébergement frontend** : tant que le frontend ne contient pas de données utilisateur, Vercel reste pratique pour la vitesse de livraison. Toute donnée sensible ne doit JAMAIS atterrir sur Vercel.

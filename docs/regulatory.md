# Contexte réglementaire

KYB Graph s'inscrit dans le cadre de la lutte contre le blanchiment et le financement du terrorisme (LCB-FT) en France et en UE. Les éléments suivants conditionnent les choix produit, les garde-fous techniques et la feuille de route.

## Règlement (UE) 2024/1624 — AMLR

**« Single rulebook »** anti-blanchiment, signé le 31 mai 2024, publié au JOUE le 19 juin 2024.

- **Applicabilité directe** dans tous les États membres à partir du **10 juillet 2027**.
- **Seuil du bénéficiaire effectif** harmonisé à **25 %** de détention ou de contrôle.
- **Signalement des divergences** entre déclaration et registre sous **14 jours**.
- Renforcement des obligations de vigilance pour les entités assujetties (banques, notaires, comptables, agents immobiliers, plateformes crypto).
- Obligation de **conserver la piste d'audit** des décisions de vigilance.

**Impact KYB Graph** :
- `cases.score_qualite_preuve` reflète directement le critère de fiabilité des sources.
- L'export PDF inclut un avertissement explicite AMLR.
- Étape 3.4 (annotations + audit trail immuable) répond à l'obligation de piste auditable.

## AMLA — Règlement (UE) 2024/1620

**Autorité européenne de lutte contre le blanchiment**, siège à **Francfort**.

- Opérationnelle depuis **mi-2025**.
- Supervision directe des entités à risque transfrontière à compter de **2028**.
- Coordination des cellules de renseignement financier nationales (Tracfin en France).
- Pouvoirs de contrôle, d'enquête et de sanction administrative.

**Impact KYB Graph** : la traçabilité des sources et la stabilité du score de vigilance devront supporter une revue par AMLA. Les exports JSON manifeste préparent cette exigence.

## CJUE — 22 novembre 2022, affaires jointes C-37/20 (WM) et C-601/20 (Sovim)

**Invalidation** de l'article 1er, paragraphe 15, point c) de la 5ᵉ directive anti-blanchiment ((UE) 2018/843), en tant qu'il rendait obligatoire la publicité du registre des bénéficiaires effectifs.

Motif : ingérence non strictement nécessaire dans le droit à la vie privée (art. 7 Charte) et à la protection des données (art. 8 Charte).

**Conséquence pratique** :
- L'accès aux données UBO est désormais **conditionné à un intérêt légitime** documenté.
- Les États membres ont restreint ou suspendu l'accès public à leurs registres UBO.

**Impact KYB Graph** :
- Le connecteur INPI **récupère** les bénéficiaires effectifs, mais `normalizeInpi` ne les **rend dans le graphe que si `INPI_EXPOSE_UBO=true`** (défaut `false`). Ce flag matérialise techniquement le gating CJUE : tant qu'il reste à `false`, aucun UBO réel n'atteint le graphe ni l'export.
- L'activation (`INPI_EXPOSE_UBO=true`) ne doit intervenir qu'**après** la mise en place de l'auth (Étape 2.2 Better-Auth, rôle minimum `analyst`) **et** de l'enregistrement obligatoire d'un intérêt légitime dans `audit_logs` (Étape 3.4).
- En mode démo public, **aucun UBO réel** n'est affiché — fixtures anonymisées uniquement.

## Tracfin (cellule de renseignement financier française)

- **2024** : **211 165 déclarations de soupçon** reçues (+13,2 %).
- 91 % des DS proviennent du secteur bancaire et des professions du chiffre.
- Marché en croissance soutenue → demande accrue d'outils d'investigation KYB.

**Impact KYB Graph** : positionnement face à des cibles institutionnelles (banques, Big 4, professions du chiffre) dont la charge déclarative augmente.

## Obligation UBO — FATF / GAFI

**149 pays** ont désormais une obligation de déclaration des bénéficiaires effectifs (recommandation 24 du GAFI, mise à jour 2022).

**Impact KYB Graph** : potentiel d'extension internationale du connecteur INPI vers d'autres registres nationaux (équivalents UE via BRIS, Companies House UK, OpenCorporates, etc.).

## Souveraineté — synthèse

Voir `docs/sovereignty.md` pour le détail. En bref :

- **Doctrine « Cloud au centre »** (DINUM, 2021) impose la souveraineté pour les données sensibles des administrations.
- **Qualification SecNumCloud 3.2** (ANSSI, 2023) : hébergement UE, immunité CLOUD Act, capitaux européens majoritaires.
- KYB Graph en démo Vercel = **OK pour fixtures**, **disqualifiant pour Tracfin/ACPR/DGSI**. Plan de migration triggré par « premier pilote signé ».

## Données personnelles — RGPD

Les bases de KYB Graph manipulent par construction des **données personnelles** (dirigeants, UBO). Conformité RGPD :

- **Finalité** : LCB-FT, due diligence, conformité — bases légales art. 6.1.c (obligation légale pour les assujettis) et 6.1.f (intérêt légitime documenté pour les autres).
- **Minimisation** : ne pas stocker plus que nécessaire ; en démo, fixtures anonymisées.
- **Conservation** : durée alignée sur les obligations de conservation des dossiers d'analyse (5 ans après clôture pour le secteur financier).
- **Droit d'accès / rectification** : à implémenter avec l'auth (Étape 2.2).
- **Sentry et SaaS US** : `beforeSend` scrubber retire le `payload` avant envoi pour éviter de transmettre des données personnelles à un SaaS soumis au CLOUD Act. Alternative à terme : GlitchTip self-hosted EU.

## Garde-fous produit issus du cadre réglementaire

| Garde-fou | Justification réglementaire |
|---|---|
| Jamais le mot « fraude » | Présomption d'innocence + prudence assureur |
| Niveau de preuve obligatoire (4 paliers) | AMLR : traçabilité des éléments de vigilance |
| Trail SHA-256 de chaque source | AMLR : conservation auditable + RGPD : intégrité |
| UBO derrière auth + log d'intérêt légitime | CJUE 2022 |
| Export PDF sourcé et horodaté | AMLR : opposabilité des décisions |
| Synthèse manuelle via Claude Code de l'utilisateur (zéro appel API tiers depuis la prod) — prompt strict « jamais fraude » embarqué dans le briefing | Présomption + RGPD : pas de transfert hors UE de données du dossier vers un service IA SaaS US |
| Migration souveraine planifiée | Doctrine DINUM + qualification SecNumCloud + CLOUD Act |

## Liens utiles

- AMLR 2024/1624 : <https://eur-lex.europa.eu/eli/reg/2024/1624>
- AMLA 2024/1620 : <https://eur-lex.europa.eu/eli/reg/2024/1620>
- Arrêt CJUE C-37/20 / C-601/20 : <https://curia.europa.eu>
- Tracfin rapport annuel : <https://www.economie.gouv.fr/tracfin>
- Recommandations GAFI : <https://www.fatf-gafi.org>
- Qualification SecNumCloud (ANSSI) : <https://www.ssi.gouv.fr/secnumcloud>

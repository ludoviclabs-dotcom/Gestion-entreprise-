# D5 — DGAL : choix de source, validation et activation

D4 confirmé validé en production par l’utilisateur le 12 octobre 2026 : 63412 synthèses, lecture 0,1 à 2 s, flags et Réglages opérationnels. D5 part du dernier main ; migration **0023**, la 0022 des registres étrangers est conservée. Fiche 03 de Guide_connecteurs_KYB_GRAPH.md consultée ; les instructions utilisateur prévalent : rapprochement par SIREN uniquement, aucun nom ni adresse, aucune radiation déduite.

## Liste précise retenue

[Répertoire DGAL](https://agriculture.gouv.fr/tous-les-etablissements-agrees-certifies-autorises-ou-enregistres-par-la-dgal) → [établissements agréés CE conformément au règlement 853/2004](https://agriculture.gouv.fr/liste-des-etablissements-agrees-ce-conformement-au-reglement-ce-ndeg8532004-lists-ue-approved). Les **18 fichiers texte** de cette page sont sélectionnés : sections 0 à XVI et cuisines centrales. Exclut dérogations, vétérinaires, agréments d’alimentation animale, santé animale et graines germées (document PDF séparé). Le périmètre n’est pas l’ensemble des autorisations DGAL.

**Formats vérifiés** : CSV séparateur virgule, champs entre guillemets, UTF-8, extension .txt, Content-Type text/plain; charset=UTF-8. Total 3057876 octets (3,06 Mo), plus gros fichier 629027 octets. Les 18 réponses donnent Last-Modified le 12 octobre 2026. La page officielle annonce une mise à jour quotidienne ; 17 fiches data.gouv déclarent daily, la fiche V déclare unknown. Import mensuel à la demande de l’utilisateur, donc la copie peut être moins récente que les listes nationales.

### Jeux data.gouv correspondants, vérifiés par URL exacte de ressource

Les 232 jeux du producteur ministère ont été parcourus dans le catalogue ; ces 18 fiches pointent exactement vers les 18 fichiers. Des anciennes fiches CE sous fr-lo existent aussi mais leurs ressources sont vides : elles ne sont pas la base de la sélection. Les dates de catalogue peuvent être anciennes alors que les ressources sont actualisées.

| Section | Jeu actuel | ID exact | Fréquence catalogue | Licence catalogue |
|---|---|---|---|---|
| 0 | [Activités générales / General activity establishments](https://www.data.gouv.fr/datasets/activites-generales-general-activity-establishments) | `5fbbc44789b7402a01f933c6` | daily | notspecified |
| I | [Viandes d'ongulés domestiques / Meat of domestic ungulates](https://www.data.gouv.fr/datasets/viandes-dongules-domestiques-meat-of-domestic-ungulates) | `5fbd1a49086f904c8d3b2cdc` | daily | notspecified |
| II | [Viandes de volailles et lagomorphes / Meat from poultry and lagomorphs](https://www.data.gouv.fr/datasets/viandes-de-volailles-et-lagomorphes-meat-from-poultry-and-lagomorphs) | `5fbd0857de0476cbe9483e02` | daily | notspecified |
| III | [Viandes de gibier d'élevage / Meat of farmed game cutting plant](https://www.data.gouv.fr/datasets/viandes-de-gibier-delevage-meat-of-farmed-game-cutting-plant) | `5fbd149c86e801273bab9632` | daily | notspecified |
| IV | [Viandes de gibier sauvage / Wild game meat](https://www.data.gouv.fr/datasets/viandes-de-gibier-sauvage-wild-game-meat) | `5fbd17355e94e27d3358b239` | daily | notspecified |
| V | [Viandes hachées, préparation de viandes et viandes séparées mécaniquement (VSM) / Minced meat, meat preparations and mechanically separated meat](https://www.data.gouv.fr/datasets/viandes-hachees-preparation-de-viandes-et-viandes-separees-mecaniquement-vsm-minced-meat-meat-preparations-and-mechanically-separated-meat) | `5fbd0611c84d286ffc61e115` | unknown | notspecified |
| VI | [Produits à base de viande / Meat products](https://www.data.gouv.fr/datasets/produits-a-base-de-viande-meat-products) | `5fce0f7c918482a76c808f9d` | daily | notspecified |
| VII | [Mollusques bivalves vivants / Live bivalve molluscs](https://www.data.gouv.fr/datasets/mollusques-bivalves-vivants-live-bivalve-molluscs) | `5fbd1c360cd2e9dce5f4aa53` | daily | notspecified |
| VIII | [Produits de la pêche / Fishery products](https://www.data.gouv.fr/datasets/produits-de-la-peche-fishery-products) | `5fbd2f74b5d1fee8f4bf66d6` | daily | notspecified |
| IX | [Lait cru, colostrum, produits laitiers et produits à base de colostrum / Raw milk and dairy products processing plant](https://www.data.gouv.fr/datasets/lait-cru-colostrum-produits-laitiers-et-produits-a-base-de-colostrum-raw-milk-and-dairy-products-processing-plant) | `5fbcff9f7e469c44ebdbe5f0` | daily | notspecified |
| X | [Oeufs et ovoproduits / Eggs and egg products processing plan](https://www.data.gouv.fr/datasets/oeufs-et-ovoproduits-eggs-and-egg-products-processing-plan) | `5fbd02a69352ba80ab3ee4a4` | daily | notspecified |
| XI | [Cuisses de grenouille et escargots / Frogs' legs and snails](https://www.data.gouv.fr/datasets/cuisses-de-grenouille-et-escargots-frogs-legs-and-snails) | `5fbcdc30658eea9e55782183` | daily | notspecified |
| XII | [Graisses animales fondues et cretons / Rendered animal fats and greaves](https://www.data.gouv.fr/datasets/graisses-animales-fondues-et-cretons-rendered-animal-fats-and-greaves) | `5fce0cd53cce7b2327eb88f3` | daily | notspecified |
| XIII | [Estomacs, vessies et boyaux traités / Treated stomachs, bladders and intestines](https://www.data.gouv.fr/datasets/estomacs-vessies-et-boyaux-traites-treated-stomachs-bladders-and-intestines) | `5fbd3182727be246888b81aa` | daily | notspecified |
| XIV | [Gélatine / Gelatine](https://www.data.gouv.fr/datasets/gelatine-gelatine) | `5fbd336cd48bdfc3b58a7bc2` | daily | notspecified |
| XV | [Collagène / Collagen](https://www.data.gouv.fr/datasets/collagene-collagen) | `5fbd32b0727be246888b81ab` | daily | notspecified |
| XVI | [Liste des établissements agréés CE produisant des produits hautement raffinés / highly refined product](https://www.data.gouv.fr/datasets/liste-des-etablissements-agrees-ce-produisant-des-produits-hautement-raffines-highly-refined-product) | `5fce540dba8ee73dd6224649` | daily | notspecified |
| RC | [Restauration Collective / Collective catering](https://www.data.gouv.fr/datasets/restauration-collective-collective-catering) | `5fce1436a91e75697771cd0a` | daily | notspecified |

**Licence : non renseignée (notspecified) dans les 18 fiches actuelles.** Aucune licence propre dans les CSV. Le pied de page du ministère indique Etalab 2.0 pour les textes, mais ses [mentions légales](https://agriculture.gouv.fr/mentions-legales), section Utilisation/reproduction, demandent une démarche préalable pour la réutilisation commerciale. Le [répertoire des informations publiques](https://agriculture.gouv.fr/informations-publiques) référence ces listes. Ne pas attribuer aux exports actuels la licence fr-lo des anciennes fiches. **Usage interne sans commercialisation confirmé par l’utilisateur le 12 octobre 2026** ; DGAL reste désactivé par défaut. Aucun message au ministère envoyé au nom de l’utilisateur.

## Colonnes et projection minimale

En-tête commun exact : Numero de département ; Numéro agrément/Approval number ; SIRET ; Raison SOCIALE - Enseigne commerciale/Name ; Adresse/Adress ; Code postal/Postal code ; Commune/Town ; Catégorie/Category ; Activités associées/Associated activities ; Espèce/Specy.

Seules **SIRET, numéro d’agrément, catégorie, activités associées** sont sélectionnées par le parseur, avant l’assemblage des objets. L’établissement est désigné par son SIRET ; son SIREN est le préfixe de neuf chiffres à Luhn valide, hors zéros ; NIC non interprété, aucun isValidSiret. Aucun rapprochement par nom/adresse, aucun nom, enseigne, adresse, courriel, téléphone ou espèce libre en base ni dans le rendu. Section et libellé proviennent du catalogue institutionnel fermé du code ; catégories/activités limitées aux codes fermés observés ; inconnus comptés et omis.

Numéro d’agrément conservé **exactement** : les formats réels varient (points, tirets, identifiants compacts, préfixe FR/suffixe CE, Corse et DOM). Seules des formes numériques avec ces marqueurs institutionnels sont admises. Une ligne par (import_id, SIRET, numéro, section), index (SIREN, import_id), FK ON DELETE CASCADE ; doublons de même section fusionnés en unionnant les codes. Un site multi-sections est compté une seule fois ; deux établissements d’un même SIREN sont distincts. Les activités associées sont celles publiées, sans en déduire une autorisation supplémentaire dans une section absente.

Les CSV ne fournissent **aucune date d’attribution, échéance ou retrait**. exported_on = date technique du Last-Modified HTTP, nullable si inconnue. Date d’observation = checked_at du dernier succès (ou imported_at), pas la date de l’agrément. Événement **agrement_sanitaire_liste**, preuve declared, source DGAL, **20 couples établissement/agrément maximum**, titre indiquant l’observation. Aucun événement de radiation ; aucun changement du modèle kyb-risk-2026.2, des trois scores, signaux, règles, qualité de preuve ou métriques.

## Vérifié sur les vraies sources — 12 octobre 2026

| Mesure | Valeur |
|---|---:|
| Fichiers complets | 18 |
| Lignes lues | 23711 |
| Lignes à SIRET exploitable | 23700 (99.9536 %) |
| SIRET absents | 11 |
| SIREN invalides / agréments inexploitables / codes inconnus | 0 / 0 / 0 |
| Doublons même site/agrément/section fusionnés | 3 |
| Lignes d’activité conservées | 23697 |
| SIREN distincts | 16625 |
| Établissements distincts | 18696 |
| Couples établissement/agrément distincts | 18989 |
| Téléchargement + projection, importeur seul | 1.607 s |
| Pic RSS importeur seul | 128.79 Mio |
| Cycle téléchargement + projection + publication PostgreSQL local | 3.535 s |
| Dont transaction d’écriture | 1.958 s |
| Pic RSS cycle PostgreSQL local inclus | 1206.61 Mio |
| Table + index/TOAST pg_total_relation_size | 6299648 octets (6,30 Mo) |
| Taille amortie par ligne, index compris | 265.84 octets |
| Deux versions pendant rafraîchissement | 12599296 octets (12,60 Mo) |
| Deuxième import réel via le socle D0 | inchangé ; un seul import ok, aucune duplication |

Manifeste SHA-256 **93e581a464c54d03cb98b6af3c54cc4e25c5dfae7433fdafa790dbdc43ad39d6**. Chaque ligne du manifeste est fichier:date-Last-Modified-ou-inconnue:SHA-256-octets-décompressés puis LF, ordre des 18 sections. La date fait partie de la projection et de son empreinte : un nouveau jour d’export force sa réécriture même à octets identiques. Version **dgal-v1-ce** ; toute évolution de projection exige une nouvelle version.

| Section | URL exacte | Lues | Rapprochables | Sans SIRET | Octets | Last-Modified (date) | Durée (s) | SHA-256 |
|---|---|---:|---:|---:|---:|---|---:|---|
| 0 | [SSA1_ACTIV_GEN.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_ACTIV_GEN.txt) | 2657 | 2656 | 1 | 340817 | 2026-10-12 | 0.228 | `99ac92d464084dece96f7d7e92d5f81b78f39cd17b7bd078c874d60904d1bbfc` |
| I | [SSA1_VIAN_ONG_DOM.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_VIAN_ONG_DOM.txt) | 1450 | 1450 | 0 | 204437 | 2026-10-12 | 0.085 | `24a8b5d7b80279584725efccf24441322ba6a9d433282227b8ea8740cb5541b7` |
| II | [SSA1_VIAN_COL_LAGO.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_VIAN_COL_LAGO.txt) | 1068 | 1068 | 0 | 136815 | 2026-10-12 | 0.078 | `336f52eb307c2c8073882bf0c7cb49a481a3ebd6ea39b5e349c882e54d91476e` |
| III | [SSA1_VIAN_GIB_ELEV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_VIAN_GIB_ELEV.txt) | 97 | 97 | 0 | 14429 | 2026-10-12 | 0.049 | `762a345f910b02d78c201073e0b8e5ea072fcc96047d58af9f527459a90e1623` |
| IV | [SSA1_VIAN_GIB_SAUV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_VIAN_GIB_SAUV.txt) | 47 | 47 | 0 | 7120 | 2026-10-12 | 0.048 | `848d91d525c042a127a6f87e1cd9a6925c24fb52f35461b0c5b5274a7dad3c75` |
| V | [SSA1_VIAND_HACHE_VSM.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_VIAND_HACHE_VSM.txt) | 1098 | 1098 | 0 | 149757 | 2026-10-12 | 0.081 | `5e62c82b8645d2aed41dcde92c15d41ce645b62f88608f9f79cfba8e1d0c34a3` |
| VI | [SSA4_AGSANPROBASEVDE_PRV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4_AGSANPROBASEVDE_PRV.txt) | 2368 | 2368 | 0 | 309709 | 2026-10-12 | 0.104 | `5e9a1e03e6f5f43abe624fe80c8f8a736c5578f270619198f33ef5657dcb8cae` |
| VII | [SSA4B_AS_CE_PRODCOQUI_COV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4B_AS_CE_PRODCOQUI_COV.txt) | 2929 | 2923 | 6 | 345986 | 2026-10-12 | 0.104 | `2d814c8e50befd1fc4985068881c0895ed13e3b1d83fc8f2b8348094ad04d3a5` |
| VIII | [SSA4B_AS_CE_PRODPECHE_COV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4B_AS_CE_PRODPECHE_COV.txt) | 1733 | 1733 | 0 | 223558 | 2026-10-12 | 0.093 | `8b323e9620f855f8dbd474a5c3f85cb5dc19c53385e1c5b55533e35059ba23a3` |
| IX | [SSA1_LAIT.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_LAIT.txt) | 4259 | 4259 | 0 | 498407 | 2026-10-12 | 0.146 | `0785e2af4f22795b35dc6efdfcfd58819dcfc63e7df72d307d201868dc9c29b0` |
| X | [SSA1_OEUF.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_OEUF.txt) | 1317 | 1317 | 0 | 155551 | 2026-10-12 | 0.087 | `0adc2282e3c12584a1c9604a67ca05af2f43f1092f94fc90cdd7e64fae9b623c` |
| XI | [SSA1_GREN_ESCARG.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA1_GREN_ESCARG.txt) | 101 | 101 | 0 | 14373 | 2026-10-12 | 0.050 | `eed556c0395c7ad4acae92b92247c985676bc77245462440fab3022302d0c01d` |
| XII | [SSA4_AGSANGREXPR_PRV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4_AGSANGREXPR_PRV.txt) | 107 | 107 | 0 | 14907 | 2026-10-12 | 0.051 | `18608dc05b8f782c3688d15921154675faa828e85bdcd4a61bec9c53371dc828` |
| XIII | [SSA4_AGR_ESVEBO_PRV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4_AGR_ESVEBO_PRV.txt) | 66 | 66 | 0 | 9012 | 2026-10-12 | 0.047 | `45624a954bf32b50fc187cba4fcd6c94cd3f90c324aee98b4268c06e90d1b5b4` |
| XIV | [SSA4_AGSANGELAT_PRV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4_AGSANGELAT_PRV.txt) | 11 | 11 | 0 | 1634 | 2026-10-12 | 0.043 | `7537ea1345b7bc71a3f34f7bce75cd84c66a0428e3eedbf4447db77fdf4bc55c` |
| XV | [SSA4_AGSANCOLL_PRV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4_AGSANCOLL_PRV.txt) | 8 | 8 | 0 | 1240 | 2026-10-12 | 0.043 | `5039ccc64ab04d1830ba5073a7ae73d841c5a82149095d46019234eb387adebe` |
| XVI | [SSA_PROD_RAFF.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA_PROD_RAFF.txt) | 7 | 7 | 0 | 1097 | 2026-10-12 | 0.046 | `a8cb8bb7fe2ae2f71f679272a9468e764864a366eb0377e50eaa2950a154a553` |
| RC | [SSA4_ASCCC_PRV.txt](https://fichiers-publics.agriculture.gouv.fr/dgal/ListesOfficielles/SSA4_ASCCC_PRV.txt) | 4388 | 4384 | 4 | 629027 | 2026-10-12 | 0.165 | `0d547f444130e36621d83c0b83d95b6a1c2c97b0dd2f25fc079e82d9707c49bc` |

Requête SQL exacte de production, trente lectures par témoin, 23697 lignes réelles, moteur PostgreSQL local PGlite et vraies migrations 0014/0023 exécutées deux fois :

| SIREN | Établissements | Couples site/agrément | Événements | p95 SQL (ms) | max SQL (ms) |
|---|---:|---:|---:|---:|---:|
| 552081317 | 0 | 0 | 0 | 6.39 | 6.79 |
| 343262622 | 2 | 2 | 2 | 3.03 | 5.35 |
| 356000000 | 1 | 1 | 1 | 3.41 | 3.44 |
| 552032534 | 0 | 0 | 0 | 3.11 | 3.17 |
| 775670284 | 0 | 0 | 0 | 2.97 | 3.43 |
| 343294195 | 8 | 8 | 8 | 3.44 | 3.85 |
| 316807015 | 30 | 30 | 20 | 3.86 | 4.09 |
| 123456782 | 0 | 0 | 0 | 2.70 | 2.91 |

EDF 552081317 absent de cette sélection ; LIDL 343262622 deux sites ; LA POSTE 356000000 un site ; DANONE 552032534 et HSBC 775670284 absents. Témoins positifs supplémentaires 343294195 (8) et 316807015 (30, chronologie plafonnée à 20). Ces absences ne valent pas non-agrément ; on ne remonte pas d’un agrément de filiale à son groupe.

Les écritures sont passées par le vrai socle D0/postgresImportStore, les vraies transactions PGlite et le sérialiseur réel postgres 3802 ; les tableaux JSONB ne sont jamais pré-encodés. PGlite est mono-session : le verrou inter-processus est neutralisé dans le script de mesure, pas dans le code livré. Aucun accès de production/secret. Mesures locales ne garantissant ni latence réseau Neon/Vercel ni durée du job GitHub ; Claude les valide après activation. Scripts et corpus minimisés jetables supprimés avant livraison.

## Garanties et limites

- Une requête SQL en snapshot : en-tête du dernier succès, totaux complets et détails bornés, aucune lecture nationale à la création d’un dossier. Dernier succès servi après échec de rafraîchissement ; premier échec et jamais importé distincts. Absence après succès explicite avec date et couverture.
- Préparation en flux avant la transaction SQL ; publication/purge atomiques et idempotence du socle D0. Un seul fichier en échec, 404 d’export, mauvais en-tête/UTF-8, CSV tronqué ou vide annule le snapshot entier et enregistre failed. Un 404 de fichier national n’est pas une absence d’agrément d’entreprise.
- Plafonds : 18 URL fixes sans redirection, 8 Mio/fichier, 64 Mio total, 64 Kio/enregistrement, 100000 lignes/fichier et lignes retenues, 60 s par téléchargement, 25 min pour la préparation, minimum national 5000 lignes retenues et ≥95 % de lignes rapprochables.
- Colonnes additionnelles/reordonnées tolérées ; quatre colonnes sélectionnées manquantes ou dupliquées refusées. Le périmètre fixe n’est pas une découverte automatique de nouvelles listes ; son évolution nécessite revue du code/version.
- Mise à jour quotidienne de l’amont, import mensuel ; pas de snapshot global atomique garanti entre les 18 exports. Last-Modified est une date de fichier, pas une date juridique.
- Code institutionnel inconnu omis et compté. Sans SIRET exploitable, pas de rapprochement, jamais un rapprochement nominatif. Pas de nom/adresse en base/fixture/test/rendu. Aucun retrait/radiation, validité actuelle ou historique d’agrément déduit.
- Couverture affichée : établissements agréés listés au jour d’observation ; l’absence ne vaut pas non-agrément. Agrément propre à un site et à ses activités, pas à toute une société/groupe. Vingt détails/événements maximum ; tous les totaux précèdent la limite.
- Licence des fiches actuelles non renseignée ; usage interne sans commercialisation confirmé pour cette livraison. Pas de message envoyé au ministère.

## Vérifications du code

Suite complète après rebase sur les registres étrangers : **1033 tests / 117 fichiers** ; TypeScript et eslint complets réussis. Compilation de production et **47 parcours Playwright** réussis avant ce rebase ; la CI revalide la version publiée. Les tests dédiés couvrent PostgreSQL avec migrations réelles deux fois, sérialiseur postgres 3802, colonnes réordonnées/manquantes, données privées piégées, fichier vide/tronqué, coupure, SIREN invalide/NIC non interprété, doubles sections et multi-sites, 20 événements, rollback/cascade, suppression sans radiation, état absent/non importé/échec, gating et non-régression des trois scores/signaux/métriques. La revue automatique est attendue avant livraison.

## SQL exact 0023

```sql
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'dgal' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dgal_approvals" (
	"import_id" uuid NOT NULL,
	"siren" text NOT NULL,
	"siret" text NOT NULL,
	"approval" text NOT NULL,
	"section" text NOT NULL,
	"categories" jsonb NOT NULL,
	"associated" jsonb NOT NULL,
	"exported_on" date,
	CONSTRAINT "dgal_approvals_import_id_siret_approval_section_pk" PRIMARY KEY("import_id","siret","approval","section"),
	CONSTRAINT "dgal_identifiers" CHECK ("dgal_approvals"."siren" ~ '^[0-9]{9}$' and "dgal_approvals"."siret" ~ '^[0-9]{14}$' and left("dgal_approvals"."siret", 9) = "dgal_approvals"."siren"),
	CONSTRAINT "dgal_arrays" CHECK (jsonb_typeof("dgal_approvals"."categories") = 'array' and jsonb_array_length("dgal_approvals"."categories") <= 24 and jsonb_typeof("dgal_approvals"."associated") = 'array' and jsonb_array_length("dgal_approvals"."associated") <= 400),
	CONSTRAINT "dgal_approvals_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dgal_approvals_siren_idx" ON "dgal_approvals" USING btree ("siren","import_id");
```

## Contrôle de l’enum — requête séparée

```sql
select string_agg(e.enumlabel, ', ' order by e.enumsortorder)
from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'source_kind';
```

## Activation utilisateur — usage interne confirmé

1. **Neon → projet KYB GRAPH → SQL Editor** : coller le SQL 0023 de la section précédente et cliquer Run. Aucun nouveau secret ni commande locale.
2. Dans le même éditeur, exécuter séparément le contrôle pg_enum : **dgal doit figurer avant manual**. Ne pas poursuivre si la valeur manque.
3. **GitHub → PR D5 → Merge pull request → Confirm merge** : fusionner vers main après le contrôle.
4. **GitHub → dépôt → onglet Actions en haut → Import open data à gauche → Run workflow à droite → main → source dgal → bouton vert Run workflow**. Attendre le succès, puis relancer pour vérifier « inchangé » si fichiers et dates d’export sont identiques. all mensuel inclut DGAL ; daily reste inchangé. DATABASE_URL_UNPOOLED est déjà configuré.
5. **Vercel → kyb-graph → Settings → Environment Variables** : DGAL_ENABLED=true, environnement Production, Save. Puis **Deployments → dernier Production de main → ⋯ → Redeploy → Redeploy** ; attendre Ready.
6. Écrire **« D5 activé »** à Claude : validation des témoins présents/absents, multi-sites, vingt événements d’observation au maximum, scores/signaux inchangés, Sources/timings.dgal et Réglages. Les dossiers existants ne sont pas enrichis automatiquement.

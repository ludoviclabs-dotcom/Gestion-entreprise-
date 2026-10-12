# D4 — DECP : validation et activation

D3 fusionné et validé en production par Claude le 12 octobre 2026 (confirmation utilisateur). D4 part de main, migration **0021**, drapeau désactivé par défaut. Les fichiers nationaux sont importés hors des consultations ; une seule requête SQL lit le dernier snapshot pour le titulaire et l'acheteur. Aucun nouveau signal, aucun changement de score ni du modèle kyb-risk-2026.2.

## Stockage retenu : plan B du §4.4

L'utilisateur indique **0,21 Go utilisés sur 0,5 Go** : environ 290 Mo disponibles, sans changement d'abonnement. Sur le jeu réel :

| Option | Table(s) et index PostgreSQL local | Deux versions pendant publication | Marge estimée sur 290 Mo |
|---|---:|---:|---:|
| Nominale, toutes les attributions | 111345664 octets | 222691328 octets | 67308672 octets |
| **Agrégée retenue** | **91291648 octets** | **182583296 octets** | **107416704 octets** |

Mesure par pg_total_relation_size avec les migrations réelles, index, TOAST et les lignes réelles minimisées. Le stockage Neon inclut d'autres éléments et peut évoluer : ceci est une estimation locale, pas une réservation de quota. Les suppressions et l'autovacuum, l'historique et les écritures concurrentes peuvent affecter la place physique. Le plan nominal n'est pas livré.

**decp_summaries** : une ligne par (import_id, SIREN, rôle holder/buyer), compte total distinct, cumul fiable des seuls marchés à un titulaire, nombres en groupement et à montant non fiable, dernière notification, cinq principaux acheteurs, vingt marchés récents. **decp_windows** : fenêtre et dernier mois de fichier disponible. Deux FK ON DELETE CASCADE, index (siren, import_id, role), tableaux jsonb bornés et contrôlés en base. Les totaux sont calculés avant la troncature. Le même SIREN par deux NIC co-titulaires est compté une fois, et chaque acheteur retrouve les marchés distincts.

## Identité et minimisation

Le flux réel est marches.marche[], avec titulaires[].titulaire.id et typeIdentifiant. Identité du marché : acheteur.id, id exact, CPV sur huit chiffres, objet normalisé haché (12 hex SHA-256) ; identité d'attribution : cette identité plus le SIRET titulaire. Les identifiants libres de marché peuvent porter du texte : **marche_id est le SHA-256 complet de l'id exact**, sans changer son égalité, pour ne conserver aucun texte susceptible de nommer une personne. Les récents conservent buyerId, marketId, CPV, objectHash, holderId, date, montant déclaré et nombre de titulaires. Les objets, noms, adresses et contacts sont rejetés par filtrage de tokens avant assemblage ; nature/procedure/source utilisent des catalogues fermés. Les tests utilisent exclusivement des marqueurs synthétiques.

SIRET : quatorze chiffres, préfixe SIREN Luhn valide et hors zéros, NIC non interprété. La Poste et les NIC malformés restent rapprochés ; aucun appel à isValidSiret. Un acheteur à SIREN invalide n'est pas rapproché comme acheteur, sans perdre le titulaire valide. Tous les types de titulaires comptent dans holder_count ; seuls les SIRET rapprochables produisent une attribution.

Montants zéro/négatifs/non numériques/≥999999999 : conservés mais marqués non fiables, hors cumul. Les groupements sont comptés à part, **montant non réparti**, sans somme ni division entre membres. Addition décimale des autres montants avant conversion numérique, sans arrondi arbitraire au centime. Les modifications ne sont pas appliquées ; leur présence est comptée.

## Vérifié sur les vraies sources — 12 octobre 2026

[Catalogue officiel](https://www.data.gouv.fr/api/1/datasets/donnees-essentielles-de-la-commande-publique-fichiers-consolides/) ; les URL mensuelles sont exclusivement celles de l'API, jamais construites. Fenêtre **2025-10-12 au 2026-10-12 inclus** sur dateNotification ; mois sélectionnés d'octobre 2025 à octobre 2026, contigus. Chaque fichier contient des notifications dans la fenêtre ; le nom du fichier ne sert pas de filtre de notification.

| Mesure | Valeur |
|---|---:|
| Fichiers complets | 13 |
| Marchés lus | 592637 |
| Dans la fenêtre, avant déduplication | 282824 |
| Hors fenêtre | 309368 |
| Dates invalides / <2015 / futures | 445 |
| Attributions rapprochables reçues | 309118 |
| Titulaires non SIRET dans la fenêtre | 1513 |
| SIREN titulaire invalides dans la fenêtre | 4033 |
| Acheteurs non rapprochables dans la fenêtre | 127 |
| Identités inexploitables dans la fenêtre | 0 |
| Marchés avec modifications (tous fichiers) | 178663 |
| Republications fusionnées | 97796 |
| Attributions distinctes conservées | 211322 |
| Synthèses SIREN/rôle | 63412 (53227 titulaire, 10185 acheteur) |
| Octets décompressés consommés | 1336397031 |
| Cycle complet téléchargement + projection + PostgreSQL local | 827.76 s |
| Écritures PostgreSQL du cycle complet | 14.884 s |
| Pic RSS du cycle complet, PostgreSQL local inclus | 1581.13 Mio |
| Reprojection des attributions réelles figées + chargement, sans retéléchargement | 15.366 s |
| Dont écritures PostgreSQL, projection finale | 9.223 s |
| Relance figée via le socle D0 | inchangé, aucune duplication |

Empreinte du manifeste ordonné (chaque ligne = mois:SHA-256 des octets décompressés du fichier, puis LF) : **eb5020a58754ea1bab8426781aecd4cb332d63ebd3d25d56fd5a18bf19128d38**. La fenêtre est aussi incluse dans la version de projection decp-v1-aggregate:AAAA-MM-JJ:AAAA-MM-JJ : une fenêtre différente force une réécriture à fichiers identiques.

| Fichier | Lus | Dans la fenêtre | Hors fenêtre | Dates invalides | Octets | SHA-256 |
|---|---:|---:|---:|---:|---:|---|
| 2025-10 | 39589 | 2377 | 37176 | 36 | 93350551 | `51846563246f1bf8de31bee6b318ac1aecff5f365d924f708f6e6e1776ccdbcc` |
| 2025-11 | 33659 | 9994 | 23644 | 21 | 81112219 | `ad892ddbd8aa72766e52c04ea5479a6c6786fc0817458661546a7a4962f94adf` |
| 2025-12 | 69498 | 23316 | 46163 | 19 | 150132674 | `86e591e64b9208fef7cb726503097e38bc05291e38466cdbfacb219183f52d33` |
| 2026-01 | 41898 | 20524 | 21335 | 39 | 92486485 | `ec7149b7134cababd6f51bbc476504dc3824da6ea87a8a691b6350154d076fd9` |
| 2026-02 | 30604 | 15441 | 15134 | 29 | 73053036 | `4813dcade685770115ba10a74837cdc3bf89b5418360f232de19aa7161420caf` |
| 2026-03 | 39035 | 21216 | 17771 | 48 | 92839235 | `20fe4ab0c79de1a7e60eb69d26e32b303eb8575d7459debe357b2ff0ed8e948d` |
| 2026-04 | 31163 | 17047 | 14083 | 33 | 75720079 | `8114588fa9e459fa88a193d959c65945587d7402d8f21f5254663a6cdadb1364` |
| 2026-05 | 28346 | 17001 | 11312 | 33 | 69264442 | `8b744d5758eaca9c87a29659469773da3a6f916b8b6de5e721966b9f5ebe5fcd` |
| 2026-06 | 63951 | 33332 | 30582 | 37 | 140687263 | `bf519c8af72a49906475b16447526c247fae69d50dce053d3afc251e3c9ef728` |
| 2026-07 | 64004 | 34045 | 29923 | 36 | 141661342 | `840db48895c7ee821abb7bc6f062a18095098a1ec7377f8f3a12e4c04a0d621b` |
| 2026-08 | 62163 | 38300 | 23816 | 47 | 134890774 | `bbdf5f7bead09bdda06fa241fc425bf19a08563cc8978a54bc0905fa8d74dc2c` |
| 2026-09 | 65808 | 41875 | 23873 | 60 | 144140354 | `6c14231ebde3c5861a1e6451fe674cacd306a1097be540e57d5ea6c59b821c23` |
| 2026-10 | 22919 | 8356 | 14556 | 7 | 47058577 | `02edc24318adae3c05286446512f820739a42dbd162c8c3e5079c4b96b982a00` |

Trente lectures de la requête exacte par témoin, migrations réelles exécutées deux fois, données réelles minimisées et vraie sérialisation jsonb du client postgres avant PostgreSQL local PGlite :

| SIREN | Marchés comme titulaire | Marchés comme acheteur | SQL p95 (ms) | SQL max (ms) |
|---|---:|---:|---:|---:|
| 552081317 | 249 | 0 | 4.75 | 4.98 |
| 343262622 | 0 | 0 | 2.40 | 2.80 |
| 356000000 | 144 | 0 | 2.56 | 2.61 |
| 552032534 | 0 | 0 | 2.84 | 3.60 |
| 775670284 | 2 | 0 | 2.76 | 3.24 |
| 123456782 | 0 | 0 | 2.13 | 2.35 |
| 130005010 | 57 | 2653 | 2.21 | 2.60 |

EDF = 552081317 ; LIDL = 343262622 ; LA POSTE = 356000000 ; DANONE = 552032534 ; HSBC Continental Europe = 775670284. 130005010 est un témoin acheteur réel : 2653 marchés, 57 comme titulaire. Ces absences DECP ne valent que pour les fichiers et la fenêtre importés ; elles ne concernent pas le répertoire HATVP.

Le cycle complet a été mesuré sous charge locale (compilation/tests en parallèle) : un maximum ponctuel de 187,61 ms a été observé, p95 ≤6,26 ms. La seconde mesure ci-dessus est faite sur la projection finale figée, sans cette charge, et mesure la requête réelle (en-tête + deux rôles) en un seul appel. Elle **ne mesure pas le réseau Vercel/Neon, les premiers appels d'instance ni le job GitHub** : Claude les valide après activation ; aucune performance de production n'est présumée. Aucun accès de production ni secret local utilisé. Scripts et corpus minimisés jetables supprimés avant livraison.

## Garanties et limites

- Téléchargement/analyse en flux ; scalaires sélectionnés ≤32768 caractères, clés ≤256, profondeur ≤64, 30000 tokens sélectionnés/marché, 1 million de marchés/fichier et 1 million d'attributions minimisées. Aucun fichier national entier en mémoire.
- Ressource ≤256 Mio, total ≤2 Gio, ≤13 fichiers, 25 minutes par ressource et 28 minutes pour la préparation complète. Fichiers vides, tronqués, mois intérieurs manquants, flux coupés et mauvais schémas annulent tout l'import.
- Préparation des seules synthèses avant le verrou SQL, pour éviter une transaction inactive pendant les téléchargements ; publication/purge/idempotence atomiques via le socle D0. Un échec amont est aussi enregistré comme tentative failed ; le dernier succès reste servi.
- Absent dans un import validé ≠ jamais importé (source non importée) ≠ premier import en échec / erreur SQL. Hors mode live ou drapeau éteint : sentinelle fixture:decp, zéro appel. SIREN invalide : endpoint decp:invalide, aucun faux appel db:.
- Des notifications récentes peuvent exister dans des fichiers plus anciens que le mois de début : ils ne sont pas lus dans cette sélection initiale. Fichier du mois courant partiel, déclarations tardives, fichiers amont évolutifs sans snapshot global, données sans titulaire SIRET exploitable et modifications sont des limites de couverture dites dans le rendu.
- Deux contrats distincts avec même acheteur, id, CPV, objet normalisé et titulaire restent fusionnés (limite connue du brief). Une republication est choisie par publication, sinon mois du fichier ; la fenêtre est appliquée aux notifications reçues.
- Le plan agrégé conserve les totaux complets de cette sélection, pas le détail ancien au-delà de vingt marchés par SIREN/rôle. Aucun nom d'acheteur n'est inventé. Les catégories inconnues restent nulles.
- Événements marche_public_attribue, preuve declared et source DECP, ≤20 au total même si les deux rôles se recoupent. Le type BOAMP marche_public_resultat est inchangé. Tests des trois scores, signaux, règles, métriques et qualité de preuve ; aucun changement du modèle.
- Réglages : déclaration decp dans status et CONNECTOR_SOURCE, label d'import ajouté ; logique de Réglages, HATVP et sanctions internationales inchangée. Groupe all mensuel étendu, groupe daily inchangé.

## SQL exact 0021 — à coller

```sql
ALTER TYPE "public"."source_kind" ADD VALUE IF NOT EXISTS 'decp' BEFORE 'manual';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decp_summaries" (
	"import_id" uuid NOT NULL,
	"siren" text NOT NULL,
	"role" text NOT NULL,
	"total" integer NOT NULL,
	"reliable_amount" numeric NOT NULL,
	"single_reliable" integer NOT NULL,
	"grouped" integer NOT NULL,
	"unreliable" integer NOT NULL,
	"last_notified" date NOT NULL,
	"buyers" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	CONSTRAINT "decp_summaries_import_id_siren_role_pk" PRIMARY KEY("import_id","siren","role"),
	CONSTRAINT "decp_summary_role" CHECK ("decp_summaries"."role" in ('holder', 'buyer')),
	CONSTRAINT "decp_summary_counts" CHECK ("decp_summaries"."total" > 0 and "decp_summaries"."single_reliable" >= 0 and "decp_summaries"."grouped" >= 0 and "decp_summaries"."unreliable" >= 0),
	CONSTRAINT "decp_summary_arrays" CHECK (jsonb_typeof("decp_summaries"."buyers") = 'array' and jsonb_array_length("decp_summaries"."buyers") <= 5 and jsonb_typeof("decp_summaries"."items") = 'array' and jsonb_array_length("decp_summaries"."items") <= 20),
	CONSTRAINT "decp_summaries_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decp_windows" (
	"import_id" uuid PRIMARY KEY NOT NULL,
	"window_start" date NOT NULL,
	"window_end" date NOT NULL,
	"latest_file_month" text NOT NULL,
	CONSTRAINT "decp_window_order" CHECK ("decp_windows"."window_start" <= "decp_windows"."window_end"),
	CONSTRAINT "decp_windows_import_id_open_data_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."open_data_imports"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decp_summaries_siren_idx" ON "decp_summaries" USING btree ("siren","import_id","role");
```

## Contrôle de l'enum — instruction séparée

```sql
select string_agg(e.enumlabel, ', ' order by e.enumsortorder)
from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'source_kind';
```

## Activation utilisateur — une seule séquence, dans cet ordre

1. **Neon → projet KYB GRAPH → SQL Editor** : coller le SQL 0021 de la section « SQL exact » ci-dessus. Le socle 0014 est déjà appliqué ; aucune commande locale ni db:migrate.
2. Dans le même éditeur, exécuter séparément le contrôle pg_enum de la section précédente : **decp doit figurer avant manual**. S'il manque, arrêter et réappliquer l'ALTER TYPE.
3. **GitHub → cette PR → Merge pull request** : fusionner vers main seulement après le contrôle de l'enum.
4. **GitHub → dépôt → onglet Actions en haut → Import open data à gauche → Run workflow à droite → branche main → source decp → bouton vert Run workflow**. Attendre le succès. Relancer le même jour pour vérifier « inchangé » si les fichiers n'ont pas changé. DATABASE_URL_UNPOOLED est déjà configuré ; aucun nouveau secret. Le job all mensuel inclut DECP, le job daily reste inchangé.
5. **Vercel → kyb-graph → Settings → Environment Variables → Production** : ajouter/modifier DECP_ENABLED=true, Save. Puis **Deployments → dernier déploiement Production de main → ⋯ → Redeploy → Redeploy**. Attendre Ready.
6. Écrire **« D4 activé »** à Claude : il valide en production les attributs titulaire/acheteur, la chronologie, les sources, les scores, Réglages et metadata.timings.decp. Les dossiers existants ne sont pas enrichis automatiquement.

import { sql, type SQL } from "drizzle-orm";
import { sourceRecords } from "@/lib/db/schema";

/**
 * Lignes GDELT d'un dossier dont la consultation n'a PAS abouti (erreur HTTP, statut
 * absent ou 0, endpoint dégradé) ET auxquelles aucune preuve ne se rattache.
 * Remplacées par la nouvelle consultation lors d'une reprise de la collecte de
 * presse : la tentative précédente reste documentée dans le journal de preuve.
 * Reste cohérent avec `isDegradedEndpoint` (src/lib/connectors/degraded.ts).
 *
 * ⚠️ Les barres obliques inverses de l'expression régulière sont DOUBLÉES : dans un
 * gabarit TypeScript, `\(` perdrait sa barre et la règle ne s'appliquerait plus.
 */
export function unachievedGdeltRecords(caseId: string): SQL {
  return sql`${sourceRecords.caseId} = ${caseId} and ${sourceRecords.source} = 'gdelt'
    and (case when ${sourceRecords.httpStatus} ~ '^[0-9]+$' then ${sourceRecords.httpStatus}::int else 0 end >= 400
         or ${sourceRecords.httpStatus} is null or ${sourceRecords.httpStatus} = '0'
         or ${sourceRecords.endpoint} ~ '\\((exception|erreur [0-9]+|schéma non reconnu|délai dépassé)\\)\\s*$')
    and not exists (select 1 from evidence e where e.source_record_id = ${sourceRecords.id})`;
}

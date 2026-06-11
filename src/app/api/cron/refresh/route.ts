import { getCasesRepository } from "@/lib/data/cases-repository";
import { bodacc } from "@/lib/connectors/bodacc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Co-localisation avec Neon (eu-central-1) : évite l'aller-retour US↔EU par requête.
export const preferredRegion = "fra1";

/**
 * Cron Vercel — exécuté chaque jour à 07h00 UTC.
 *
 * Pour chaque dossier `status:'ready'`, on re-fetch BODACC et on détecte les
 * annonces publiées depuis le dernier rafraîchissement. Si nouvelle entrée
 * → re-compute du risque (en BDD réelle, via DbCasesRepository).
 *
 * Aujourd'hui : version stub qui parcourt la liste, ré-appelle BODACC en
 * mode démo (= fixtures), et renvoie un récap. Étape 3.7 « MVP » :
 * la logique d'update réelle (insert events + re-compute risk + notification)
 * est rajoutée quand Neon est branché.
 *
 * Sécurité : gate par `CRON_SECRET` envoyé en header Authorization par Vercel
 * (cf. vercel.json crons + Settings → Environment Variables).
 */
export async function GET(request: Request) {
  // Gate Vercel Cron : le header Authorization contient `Bearer <CRON_SECRET>`.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const cases = await getCasesRepository().listCases();
  const updates: Array<{
    caseId: string;
    siren: string;
    newEvents: number;
    isFixture: boolean;
  }> = [];

  for (const c of cases) {
    if (c.status !== "ready") continue;
    try {
      const res = await bodacc.bySiren(c.rootSiren);
      const records =
        ((res.raw as { results?: unknown[] }).results ?? []).length;
      updates.push({
        caseId: c.id,
        siren: c.rootSiren,
        newEvents: records,
        isFixture: res.isFixture,
      });
    } catch (error) {
      console.error(`[cron] échec refresh ${c.id}`, error);
    }
  }

  return Response.json({
    generatedAt: new Date().toISOString(),
    processed: updates.length,
    updates,
    note: "Stub Étape 3.7 — la re-ingestion réelle requiert Neon activé.",
  });
}

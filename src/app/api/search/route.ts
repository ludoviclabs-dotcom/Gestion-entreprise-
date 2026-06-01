import { NextResponse } from "next/server";
import { z } from "zod";
import { sirene } from "@/lib/connectors/sirene";

export const runtime = "nodejs";

type SearchPeriode = {
  denominationUniteLegale?: string | null;
  activitePrincipaleUniteLegale?: string | null;
  etatAdministratifUniteLegale?: string | null;
};
type SearchUL = { siren?: string; periodesUniteLegale?: SearchPeriode[] };
type SearchResponse = { unitesLegales?: SearchUL[] };

const bodySchema = z.object({ q: z.string().min(1).max(200) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètre « q » requis (1–200 caractères)." },
      { status: 400 },
    );
  }

  const result = await sirene.search(parsed.data.q);
  const uls = (result.raw as SearchResponse).unitesLegales ?? [];
  const candidates = uls
    .map((ul) => {
      const p = ul.periodesUniteLegale?.[0] ?? {};
      return {
        siren: ul.siren ?? "",
        denomination: p.denominationUniteLegale ?? null,
        naf: p.activitePrincipaleUniteLegale ?? null,
        etat: p.etatAdministratifUniteLegale ?? null,
      };
    })
    .filter((c) => c.siren);

  return NextResponse.json({
    candidates,
    source: result.isFixture ? "demo" : "sirene",
  });
}

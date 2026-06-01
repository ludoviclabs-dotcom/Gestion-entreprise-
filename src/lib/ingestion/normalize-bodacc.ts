import type { CaseEvent } from "@/lib/graph/graph-types";

type BodaccRecord = {
  id?: string;
  registre?: string | string[];
  dateparution?: string;
  familleavis_lib?: string;
  commercant?: string;
  jugement?: unknown;
};
type BodaccResponse = { results?: BodaccRecord[] };

function kindFor(famille: string | undefined, hasJugement: boolean): string {
  const f = (famille ?? "").toLowerCase();
  if (
    hasJugement ||
    f.includes("procédure") ||
    f.includes("procedure") ||
    f.includes("jugement")
  )
    return "procedure_collective";
  if (f.includes("radiation")) return "radiation";
  if (
    f.includes("création") ||
    f.includes("creation") ||
    f.includes("immatriculation")
  )
    return "creation";
  if (f.includes("dépôt") || f.includes("depot") || f.includes("comptes"))
    return "depot_comptes";
  if (f.includes("modification")) return "modification";
  return "autre";
}

export function normalizeBodacc(raw: unknown, companyId: string): CaseEvent[] {
  const results = (raw as BodaccResponse).results ?? [];
  return results.map((r, i) => {
    const hasJugement = r.jugement != null && r.jugement !== "";
    return {
      id: `ev:bodacc:${r.id ?? i}`,
      entityId: companyId,
      kind: kindFor(r.familleavis_lib, hasJugement),
      title: r.familleavis_lib ?? "Annonce BODACC",
      occurredOn: r.dateparution,
      evidenceLevel: "confirmed" as const,
      source: `BODACC${r.dateparution ? ` — ${r.dateparution}` : ""}`,
    };
  });
}

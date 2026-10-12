import { z } from "zod";
import { isValidSiren } from "@/lib/siren";
import { DGAL_APPROVAL, DGAL_CODES, DGAL_SECTIONS } from "./dgal-reference";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const section = z.enum(DGAL_SECTIONS.map(s => s.code) as [string, ...string[]]);
const code = z.enum(DGAL_CODES);
const associated = z.string().refine(s => {
  const m = /^(0|I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|RC)\(([A-Z]+)\)$/.exec(s);
  return !!m && (DGAL_CODES as readonly string[]).includes(m[2]);
});
const count = z.number().int().nonnegative();
export const dgalData = z.object({ status: z.literal("ok"),
  siren: z.string().regex(/^\d{9}$/).refine(s => s !== "000000000" && isValidSiren(s)),
  importedAt: z.string().datetime({ offset: true }), observedAt: z.string().datetime({ offset: true }),
  totalSites: count, totalApprovals: count,
  bySection: z.array(z.object({ section, count })).max(18),
  items: z.array(z.object({ siret: z.string().regex(/^\d{14}$/), approval: z.string().regex(DGAL_APPROVAL),
    exportedOn: day.nullable(), activities: z.array(z.object({ section, categories: z.array(code).max(24), associated: z.array(associated).max(400) })).min(1).max(18),
  })).max(20),
}).refine(d => d.items.every(i => i.siret.slice(0, 9) === d.siren) && d.items.length <= d.totalApprovals && d.totalSites <= d.totalApprovals);
export type DgalRaw = z.infer<typeof dgalData>;

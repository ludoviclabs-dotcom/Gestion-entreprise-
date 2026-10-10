import { z } from "zod";
const count = z.number().int().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const groups = z.array(z.object({ label: z.string().nullable(), count }));
export const importedIcpeData = z.object({
  status: z.literal("ok"), coverage: z.literal("national-import"), importedAt: z.string().datetime({ offset: true }),
  total: count, establishments: count, byRegime: groups, byStatus: groups, bySeveso: groups,
  ied: count, nationalPriority: count, inspections: count, lastInspection: day.nullable(),
  sites: z.array(z.object({ codeAiot: z.string().min(1), siret: z.string().regex(/^\d{14}$/),
    name: z.string().nullable(), commune: z.string().nullable(), regime: z.string().nullable(),
    seveso: z.string().nullable(), ied: z.boolean().nullable(), nationalPriority: z.boolean().nullable(),
    status: z.string().nullable(), inspections: count, lastInspection: day.nullable() })).max(20),
});
export type ImportedIcpeRaw = z.infer<typeof importedIcpeData>;

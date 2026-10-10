import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s =>
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const count = z.number().int().nonnegative();
const groups = z.array(z.object({ label: z.string(), count }));
export const caminoData = z.object({
  status: z.literal("ok"),
  importedAt: z.string().datetime({ offset: true }),
  total: count,
  byStatus: groups,
  byDomain: groups,
  validUntil: day.nullable(),
  items: z.array(z.object({
    id: z.string().min(1), name: z.string(), type: z.string(), domain: z.string(), status: z.string(),
    startsOn: day.nullable(), endsOn: day.nullable(), holder: z.boolean(), operator: z.boolean(),
  })).max(20),
});
export type CaminoRaw = z.infer<typeof caminoData>;

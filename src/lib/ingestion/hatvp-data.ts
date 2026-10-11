import { z } from "zod";
import { isValidSiren } from "@/lib/siren";
import { hatvpCategory } from "./hatvp-categories";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s =>
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
export const hatvpOrganisation = z.object({
  siren: z.string().regex(/^\d{9}$/).refine(s => s !== "000000000" && isValidSiren(s)),
  categoryCode: z.string().nullable(), categoryLabel: z.string().nullable(), categoryGroup: z.string().nullable(),
  firstPublishedOn: day.nullable(), lastActivityPublishedOn: day.nullable(), activitiesPublished: z.boolean().nullable(),
  lastExerciseEnd: day.nullable(), activityCountLast: z.number().int().min(0).max(2147483647).nullable(),
  noActivityDeclared: z.boolean().nullable(), ceasedOn: day.nullable(),
  deregistrationReason: z.enum(["CESSATION", "ABANDON"]).nullable(),
}).refine(r => {
  const c = hatvpCategory(r.categoryCode);
  return c ? r.categoryLabel === c.label && r.categoryGroup === c.group
    : r.categoryCode === null && r.categoryLabel === null && r.categoryGroup === null;
});
export const hatvpData = z.object({
  status: z.literal("ok"), importedAt: z.string().datetime({ offset: true }), organisation: hatvpOrganisation.nullable(),
});
export type HatvpRaw = z.infer<typeof hatvpData>;

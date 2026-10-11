import { z } from "zod";
import { isValidSiren } from "@/lib/siren";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const siren = z.string().regex(/^\d{9}$/).refine(s => s !== "000000000" && isValidSiren(s));
const siret = z.string().regex(/^\d{14}$/);
const count = z.number().int().nonnegative();
const item = z.object({ key: z.string().regex(/^[a-f0-9]{32}$/), buyerId: siret, holderId: siret,
  marketId: z.string().regex(/^[a-f0-9]{64}$/), objectHash: z.string().regex(/^[a-f0-9]{12}$/),
  cpv: z.string().regex(/^\d{8}$/), notifiedOn: day, holderCount: count.min(1),
  amount: z.number().finite().nullable(), amountUnreliable: z.boolean() });
const summary = z.object({ total: count, reliableAmount: z.number().finite().nonnegative(),
  singleReliable: count, grouped: count, unreliable: count, lastNotified: day.nullable(),
  buyers: z.array(z.object({ id: siret, count })).max(5), items: z.array(item).max(20) });
export const decpData = z.object({ status: z.literal("ok"), siren, importedAt: z.string().datetime({ offset: true }),
  windowStart: day, windowEnd: day, latestFileMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  holder: summary, buyer: summary }).refine(d => d.windowStart <= d.windowEnd &&
    [...d.holder.items, ...d.buyer.items].every(i => i.notifiedOn >= d.windowStart && i.notifiedOn <= d.windowEnd) &&
    d.holder.items.every(i => i.holderId.slice(0, 9) === d.siren) && d.buyer.items.every(i => i.buyerId.slice(0, 9) === d.siren));
export type DecpRaw = z.infer<typeof decpData>;

import { z } from "zod";
import { LOOT_CATEGORIES } from "./planner";
const settings = z.object({
  count: z.number().int().min(1).max(1000),
  margin: z.number().min(0).lt(1),
  winPercent: z.number().min(0).max(100).default(25),
  winValuePercent: z.number().min(101).max(300).default(130),
  leadersOnly: z.boolean().optional(),
  minimumPotions: z.number().int().min(0).max(10).optional(),
  general: z.number().int().positive().max(10_000_000),
  premium: z.number().int().positive().max(10_000_000),
  exclusive: z.number().int().positive().max(10_000_000),
  boxTypes: z.array(z.object({tier:z.enum(["General","Premium","Exclusive"]),count:z.number().int().min(1).max(1000),price:z.number().int().positive().max(10_000_000)})).min(1).max(3).optional(),
}).refine((s)=>s.boxTypes ? new Set(s.boxTypes.map(row=>row.tier)).size===s.boxTypes.length&&s.boxTypes.reduce((sum,row)=>sum+row.count,0)<=1000 : s.general<=s.premium&&s.premium<=s.exclusive, "Use distinct box types, up to 1,000 boxes total, or ordered automatic prices.");
export const lootCommand = z.discriminatedUnion("action", [
  z.object({action:z.literal("deleteEvent"),eventId:z.uuid()}),
  z.object({action:z.literal("exclude"),key:z.string().min(1).max(2000),excluded:z.boolean()}),
  z.object({action:z.literal("bundle"),id:z.uuid().optional(),name:z.string().trim().max(120).optional(),enabled:z.boolean(),lines:z.array(z.object({key:z.string().min(1).max(2000),quantity:z.number().int().min(1).max(1000)})).min(1).max(50)}),
  z.object({action:z.literal("deleteBundle"),id:z.uuid()}),
  z.object({ action:z.literal("import"), kind:z.enum(["store","event"]), csv:z.string().min(1).max(20_000_000) }),
  z.object({ action:z.literal("price"), key:z.string().min(1).max(2000), unitValue:z.number().min(0).max(100_000_000).nullable(), category:z.enum(LOOT_CATEGORIES), excluded:z.boolean(), reviewed:z.boolean(), leading:z.boolean().optional() }),
  z.object({ action:z.literal("plan"), eventId:z.uuid().optional(), name:z.string().trim().min(1).max(120), settings }),
  z.object({ action:z.literal("preview"), settings }),
  z.object({ action:z.literal("purchase"), eventId:z.uuid(), userId:z.uuid(), tier:z.enum(["General","Premium","Exclusive","Special"]), quantity:z.number().int().min(0).max(1000) }),
  z.object({ action:z.literal("distribute"), eventId:z.uuid() }),
  z.object({ action:z.literal("open"), boxId:z.uuid() }),
  z.object({ action:z.literal("fulfill"), boxId:z.uuid() }),
]);
export type LootCommand = z.infer<typeof lootCommand>;

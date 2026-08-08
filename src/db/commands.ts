import { z } from "zod";

const uuid = z.uuid();
const septims = z.number().int().nonnegative();
const quantity = z.number().int().positive();
const occurredAt = z.coerce.date();

export const receiptLineCommand = z.object({ itemId: uuid, quantity, totalSeptims: septims });
export const createReceiptCommand = z.object({
  storeId: uuid, direction: z.enum(["store_purchase", "store_sale"]), notes: z.string().trim().max(10_000).optional(),
  lines: z.array(receiptLineCommand).min(1).max(100)
}).superRefine((input, context) => {
  const items = new Set<string>();
  input.lines.forEach((line, index) => {
    if (items.has(line.itemId)) context.addIssue({ code: "custom", path: ["lines", index, "itemId"], message: "An item may appear once per receipt; combine its quantity." });
    items.add(line.itemId);
  });
});

export const submitObservationCommand = z.object({
  storeId: uuid, itemId: uuid, quantity, totalSeptims: septims
});

// A public report intentionally has no storeId, location choice, or occurrence
// override. It is always a street-price report, is queued for platform review,
// and uses its submission time.
export const submitPublicMarketReportCommand = z.object({
  itemId: uuid,
  quantity,
  totalSeptims: septims,
  note: z.string().trim().max(10_000).optional()
}).strict();

export const reviewPublicMarketReportCommand = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1_000).optional()
});

export const stockCorrectionCommand = z.object({ storeId: uuid, itemId: uuid, quantityDelta: z.number().int().refine((value) => value !== 0), reason: z.string().trim().min(3).max(1_000) });
/** Sets the current shelf quantity through an append-only correction; any store member may reconcile. */
export const stockReconciliationCommand = z.object({
  storeId: uuid,
  itemId: uuid,
  actualQuantity: z.number().int().nonnegative(),
  note: z.string().trim().max(1_000).optional()
});
export const recipeCommand = z.object({
  storeId: uuid.optional(), outputItemId: uuid, outputYield: quantity, masteryTier: z.string().trim().max(80).optional(), laborFee: septims,
  ingredients: z.array(z.object({ itemId: uuid, quantity })).min(1).max(50)
});
export const officialPriceRuleCommand = z.object({
  storeId: uuid.optional(), itemId: uuid, side: z.enum(["store_pays", "customer_pays"]), minimumSeptims: septims, maximumSeptims: septims,
  quantity, maximumQuantity: quantity.optional(), effectiveFrom: occurredAt, effectiveTo: occurredAt.optional(), sourceLabel: z.string().trim().min(1).max(180), provenanceUrl: z.url().optional()
}).refine((value) => value.maximumSeptims >= value.minimumSeptims, { message: "Maximum must be at least minimum.", path: ["maximumSeptims"] })
  .refine((value) => !value.maximumQuantity || value.maximumQuantity >= value.quantity, { message: "Maximum quantity must be at least quantity.", path: ["maximumQuantity"] })
  .refine((value) => !value.effectiveTo || value.effectiveTo > value.effectiveFrom, { message: "End date must be after start date.", path: ["effectiveTo"] });

export type CreateReceiptCommand = z.infer<typeof createReceiptCommand>;
export type SubmitObservationCommand = z.infer<typeof submitObservationCommand>;
export type SubmitPublicMarketReportCommand = z.infer<typeof submitPublicMarketReportCommand>;

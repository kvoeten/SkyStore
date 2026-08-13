import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/runtime";
import { catalogItems } from "@/db/schema";
import { MINING_RESOURCE_TIERS } from "@/lib/profession-reference-guides";

export type MiningReferenceGuideView = Array<{
  tier: string;
  resources: Array<{
    name: string;
    price: number;
    evidence: string;
    catalogItem: { id: string; displayName: string } | null;
  }>;
}>;

export async function getMiningReferenceGuide(): Promise<MiningReferenceGuideView> {
  const names = [...new Set(MINING_RESOURCE_TIERS.flatMap((tier) => tier.resources.map((resource) => resource.catalogName)))];
  const rows = await db.select({
    id: catalogItems.id,
    displayName: catalogItems.displayName,
    stableKey: catalogItems.stableKey,
  }).from(catalogItems).where(and(eq(catalogItems.status, "active"), inArray(catalogItems.displayName, names)));

  return MINING_RESOURCE_TIERS.map((tier) => ({
    tier: tier.tier,
    resources: tier.resources.map((resource) => {
      const match = rows.filter((item) => item.displayName === resource.catalogName)
        .sort((left, right) => left.stableKey.localeCompare(right.stableKey))[0];
      return {
        name: resource.name,
        price: resource.price,
        evidence: resource.evidence,
        catalogItem: match ? { id: match.id, displayName: match.displayName } : null,
      };
    }),
  }));
}

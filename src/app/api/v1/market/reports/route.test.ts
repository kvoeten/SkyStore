import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  getAccessContext: vi.fn(),
  getTailoringPriceFamily: vi.fn(),
  inserts: [] as Array<Record<string, unknown>>,
  transaction: vi.fn()
}));

vi.mock("@/lib/authorization", () => ({ getAccessContext: testState.getAccessContext }));
vi.mock("@/lib/services/recipe-queries", () => ({ getTailoringPriceFamily: testState.getTailoringPriceFamily }));
vi.mock("@/db/runtime", () => ({ db: { transaction: testState.transaction } }));

import { POST } from "./route";

const itemId = "d3aa78a5-a1b6-49f1-a706-4d54c698711e";
const reportId = "050f6b61-f5bb-4dda-bd2f-3af70482777f";

describe("public market report route", () => {
  beforeEach(() => {
    testState.inserts.length = 0;
    testState.getAccessContext.mockReset().mockResolvedValue(null);
    testState.getTailoringPriceFamily.mockReset().mockResolvedValue({
      canonicalItemId: itemId,
      displayName: "Iron Ore"
    });
    testState.transaction.mockReset().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ id: itemId }]) }))
          }))
        })),
        insert: vi.fn(() => ({
          values: vi.fn((values: Record<string, unknown>) => {
            testState.inserts.push(values);
            if (testState.inserts.length === 1) {
              return { returning: vi.fn().mockResolvedValue([{ id: reportId, status: "pending", createdAt: new Date("2026-08-09T00:00:00Z") }]) };
            }
            return Promise.resolve();
          })
        }))
      };
      return callback(tx);
    });
  });

  it("accepts an anonymous report and creates only pending, unattributed records", async () => {
    const request = new Request("http://localhost/api/v1/market/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, quantity: 4, totalSeptims: 1 })
    });

    const response = await POST(request as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ id: reportId, status: "pending" });
    expect(testState.inserts).toHaveLength(3);
    expect(testState.inserts[0]).toMatchObject({
      itemId,
      quantity: 4,
      totalSeptims: 1,
      locationType: "street_sale",
      submittedBy: null,
      contributorDisplayName: "Anonymous visitor",
      status: "pending"
    });
    expect(testState.inserts[1]).toMatchObject({
      targetType: "public_market_report",
      targetId: reportId,
      requestedBy: null
    });
    expect(testState.inserts[2]).toMatchObject({
      actorId: null,
      action: "public_market_report.submitted",
      entityType: "public_market_report",
      entityId: reportId,
      after: expect.objectContaining({ authenticated: false })
    });
  });
});

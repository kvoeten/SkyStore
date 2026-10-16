import { expect, it } from "vitest";
import { canManageWhiterunStorage } from "./access";
const user = { userId: "user", globalRole: "user" as const, memberships: [] };
it("restricts chest operations to the two named Discord identities", () => {
  expect(canManageWhiterunStorage(null)).toBe(false);
  expect(canManageWhiterunStorage({ ...user, discordId: "314050267341520899" })).toBe(true);
  expect(canManageWhiterunStorage({ ...user, discordId: "145997830052380674" })).toBe(true);
  expect(canManageWhiterunStorage({ ...user, discordId: "someone", globalRole: "platform_admin" })).toBe(false);
});

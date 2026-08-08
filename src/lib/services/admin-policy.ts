export type ManagedRole = "clerk" | "manager" | "owner";
/** Managers may manage staff, but only the owner can alter an owner membership. */
export function mayChangeMembership(actor: ManagedRole, target: ManagedRole, next?: ManagedRole): boolean { return actor === "owner" || (target !== "owner" && next !== "owner"); }
export function quarantineOutcome(pendingReceipts: number, observations: number, approvedReceipts: number) { return { rejectedReceipts: pendingReceipts, quarantinedObservations: observations, approvedReceiptsFlaggedForReview: approvedReceipts, confirmedStockChanged: false }; }

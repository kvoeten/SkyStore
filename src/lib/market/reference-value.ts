export type MarketReferenceInputs = {
  /** A direct player-to-player trade price, without a store margin. */
  streetValue?: number | null;
  /** A published selling guide, used until a direct street value is reported. */
  officialCustomerPays?: number | null;
};

/**
 * The public reference follows direct street trade only. Store buying and
 * selling reports are deliberately excluded: their margin is useful evidence
 * for shopkeepers, but not the value of the item itself.
 */
export function marketReferenceValue({ streetValue, officialCustomerPays }: MarketReferenceInputs): number | null {
  return streetValue ?? officialCustomerPays ?? null;
}

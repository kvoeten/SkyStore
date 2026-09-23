export const SKYRIM_HOLDS = [
  "Whiterun",
  "Falkreath",
  "Haafingar",
  "Hjaalmarch",
  "The Pale",
  "The Reach",
  "The Rift",
  "Eastmarch",
  "Winterhold"
] as const;

export type SkyrimHold = (typeof SKYRIM_HOLDS)[number];

export const DEFAULT_MARKET_REGION: SkyrimHold = "Whiterun";

export function marketRegion(value?: string | null): SkyrimHold {
  return SKYRIM_HOLDS.find((hold) => hold.toLocaleLowerCase() === value?.trim().toLocaleLowerCase()) ?? DEFAULT_MARKET_REGION;
}

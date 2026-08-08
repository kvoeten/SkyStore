export const PROFESSIONS = [
  { slug: "alchemy", label: "Alchemy" },
  { slug: "cooking", label: "Cooking" },
  { slug: "enchanting", label: "Enchanting" },
  { slug: "hunting", label: "Hunting" },
  { slug: "mining", label: "Mining" },
  { slug: "smithing", label: "Smithing" },
  { slug: "tailoring", label: "Tailoring" },
  { slug: "woodworking", label: "Woodworking" },
] as const;

export const MASTERY_TIERS = ["Novice", "Advanced", "Expert", "Master"] as const;

export type Profession = (typeof PROFESSIONS)[number];

export function professionBySlug(slug: string): Profession | undefined {
  return PROFESSIONS.find((profession) => profession.slug === slug.toLowerCase());
}

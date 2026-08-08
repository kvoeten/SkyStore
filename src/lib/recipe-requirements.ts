export type RecipeRequirement = {
  kind: "profession" | "book" | "perk" | "record";
  label: string;
  description: string;
  alternativeGroup: string | null;
};

const DESCRIPTIONS: Record<RecipeRequirement["kind"], string> = {
  profession: "Profession level",
  book: "Recipe book",
  perk: "Perk",
  record: "Additional requirement",
};

export function parseRecipeRequirements(conditions: string[]): RecipeRequirement[] {
  const requirements = conditions.flatMap((condition): RecipeRequirement[] => {
    const alternative = condition.startsWith("requires:any:");
    const alternativeParts = alternative ? condition.slice("requires:any:".length).split(":") : [];
    const alternativeGroup = alternative ? alternativeParts.shift() ?? null : null;
    const normalized = alternative ? `requires:${alternativeParts.join(":")}` : condition;
    if (normalized.startsWith("requires:profession:")) {
      const [profession, mastery] = normalized.slice("requires:profession:".length).split(":", 2);
      if (!profession || !mastery) return [];
      return [{ kind: "profession", label: `${mastery} ${profession}`, description: DESCRIPTIONS.profession, alternativeGroup }];
    }
    for (const kind of ["book", "perk", "record"] as const) {
      const prefix = `requires:${kind}:`;
      if (normalized.startsWith(prefix) && normalized.length > prefix.length) {
        return [{ kind, label: normalized.slice(prefix.length), description: DESCRIPTIONS[kind], alternativeGroup }];
      }
    }
    return [];
  });
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    const key = `${requirement.alternativeGroup}:${requirement.kind}:${requirement.label}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

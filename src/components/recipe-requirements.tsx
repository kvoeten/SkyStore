import type { RecipeRequirement } from "@/lib/recipe-requirements";

export function RecipeRequirements({ requirements }: { requirements: RecipeRequirement[] }) {
  if (!requirements.length) return null;
  const required = requirements.filter((requirement) => requirement.alternativeGroup == null);
  const alternativeGroups = new Map<string, RecipeRequirement[]>();
  for (const requirement of requirements.filter((entry) => entry.alternativeGroup != null)) {
    const group = requirement.alternativeGroup!;
    alternativeGroups.set(group, [...(alternativeGroups.get(group) ?? []), requirement]);
  }
  const chip = (requirement: RecipeRequirement) => <span className={`recipe-requirement ${requirement.kind}`} key={`${requirement.alternativeGroup}:${requirement.kind}:${requirement.label}`}>
    <small>{requirement.description}</small>{requirement.label}
  </span>;
  return <div className="recipe-requirements" aria-label="Crafting requirements">
    <b>Requires</b>
    <div>{required.map(chip)}{[...alternativeGroups.entries()].map(([group, alternatives]) => <span className="recipe-alternatives" key={group}><small>One of</small>{alternatives.map(chip)}</span>)}</div>
  </div>;
}

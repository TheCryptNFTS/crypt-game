export type CommanderIdentity = {
  archetype:
    | "one_of_one"
    | "legendary"
    | "exact_match_specialist"
    | "category_sync"
    | "utility_control"
    | "tempo_pressure"
    | "baseline";
  headline: string;
  gameplayNotes: string[];
};

export function buildCommanderIdentity(input: {
  name: string;
  traits?: Record<string, string>;
  reasons?: string[];
}) : CommanderIdentity {
  const traits = input.traits ?? {};
  const reasons = input.reasons ?? [];

  if (traits["One of One"]) {
    return {
      archetype: "one_of_one",
      headline: `${input.name} is a singular exception commander.`,
      gameplayNotes: [
        "Expect bespoke identity pressure.",
        "This commander should feel rare, dangerous, and non-generic.",
        "Avoid flattening this into ordinary stat soup."
      ]
    };
  }

  if (traits["Legendary"] === "Legendary") {
    return {
      archetype: "legendary",
      headline: `${input.name} is a prestige aura commander.`,
      gameplayNotes: [
        "Legendary lanes should broaden strategic pressure.",
        "They should amplify identity, not just inflate numbers.",
        "Keep their bonuses readable and premium."
      ]
    };
  }

  if (reasons.some((x) => /Exact match/i.test(x))) {
    return {
      archetype: "exact_match_specialist",
      headline: `${input.name} is tuned for high-ceiling exact trait spikes.`,
      gameplayNotes: [
        "Exact matches should feel meaningful.",
        "Ceiling should exist, but avoid runaway stacking.",
        "Surface exact-match causes clearly in UI."
      ]
    };
  }

  if (reasons.some((x) => /Shared category/i.test(x))) {
    return {
      archetype: "category_sync",
      headline: `${input.name} favors broad trait-category consistency.`,
      gameplayNotes: [
        "Category sync should be steadier than exact match.",
        "This archetype rewards cleaner deck construction.",
        "Lower ceiling than exact-match spikes."
      ]
    };
  }

  if (reasons.some((x) => /utility/i.test(x))) {
    return {
      archetype: "utility_control",
      headline: `${input.name} is built around armor-pierce and board manipulation pressure.`,
      gameplayNotes: [
        "Utility should matter visibly against armor.",
        "Control value must not become invisible arithmetic.",
        "Log damage breakdowns clearly."
      ]
    };
  }

  if (reasons.some((x) => /speed|tempo/i.test(x))) {
    return {
      archetype: "tempo_pressure",
      headline: `${input.name} is tuned for tempo and striking priority.`,
      gameplayNotes: [
        "Speed should change meaningful turn texture.",
        "Tempo builds must feel sharp, not noisy.",
        "Reward clean sequencing."
      ]
    };
  }

  return {
    archetype: "baseline",
    headline: `${input.name} is a baseline commander identity.`,
    gameplayNotes: [
      "This lane should remain readable and stable.",
      "Baseline commanders should still feel intentional.",
      "Avoid dead, forgettable bonus packages."
    ]
  };
}

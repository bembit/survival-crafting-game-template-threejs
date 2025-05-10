// src/config/SkillTreeConfig.js

/**
 * Creates an array of stat effect objects, one for each rank,
 * using explicitly provided values.
 *
 * @param {string} stat - The name of the stat to modify (e.g., "maxHealth").
 * @param {number[]} valuesPerRank - An array of numbers, where each number is the *total* value for that rank (index 0 = Rank 1, index 1 = Rank 2, etc.).
 * @param {'additive' | 'multiplicative'} [type='additive'] - The type of modification.
 * @returns {Array<{stat: string, value: number, type: string}>} An array of effect objects for each rank.
 */
const createRankedStatEffect = (stat, valuesPerRank, type = "additive") => {
  if (!Array.isArray(valuesPerRank) || valuesPerRank.length === 0) {
    console.warn(
      `createRankedStatEffect: Invalid or empty valuesPerRank array provided for stat "${stat}".`
    );
    return []; // Return empty array if input is invalid
  }
  // Map the provided values to the effect object structure
  return valuesPerRank.map((value, index) => {
    if (typeof value !== "number") {
      console.warn(
        `createRankedStatEffect: Non-numeric value found at index ${index} for stat "${stat}". Using 0.`
      );
      value = 0; // Use 0 as a fallback for invalid values
    }
    return { stat, value, type };
  });
};

// --- Skill Tree Definition ---
export const SKILL_TREE_CONFIG = {
  // --- Tier 1 (Level 1+) ---
  toughness: {
    id: "toughness",
    name: "Toughness",
    description: "Increases maximum health.",
    maxRank: 3,
    requiredLevel: 1,
    costPerRank: [1, 2, 3], // Costs 1, then 2, then 3 points
    prerequisites: [], // No prerequisites
    // --- Use the helper with an array of values ---
    effectsPerRank: createRankedStatEffect("maxHealth", [5, 12, 21]), // Rank 1: +5, Rank 2: +7, Rank 3: +9 total
    iconSvgPath: "/icons/health-increase.svg",
    uiPosition: { x: 0, y: 50 }, // Position in UI !important
  },
  basic_strength: {
    id: "basic_strength",
    name: "Basic Strength",
    description: "Increases base melee damage.",
    maxRank: 3,
    requiredLevel: 1,
    costPerRank: [1, 2, 3],
    prerequisites: [],
    effectsPerRank: createRankedStatEffect("damage", [1, 3, 5]), // Rank 1: +1, Rank 2: +2, Rank 3: +3 total
    iconSvgPath: "/icons/sword-wound.svg",
    uiPosition: { x: 100, y: 50 },
  },
  cold_acclimation: {
    id: "cold_acclimation",
    name: "Cold Acclimation",
    description: "Increases resistance to cold.",
    maxRank: 3,
    requiredLevel: 1,
    costPerRank: [1, 2, 3],
    prerequisites: [],
    effectsPerRank: createRankedStatEffect("coldResistance", [0.05, 0.1, 0.15]), // +5%, +10%, +15% total
    iconSvgPath: "/icons/cold-heart.svg",
    uiPosition: { x: -100, y: 50 },
  },

  // --- Tier 2 (Level 5+) ---
  movement_speed: {
    id: "movement_speed",
    name: "Speed",
    description: "Increases your walking and running speed.",
    maxRank: 3,
    requiredLevel: 5,
    costPerRank: [1, 3, 5],
    prerequisites: [],
    effectsPerRank: createRankedStatEffect("speed", [0.1, 0.25, 0.5]), // +0.1, +0.25, +0.5 total
    iconSvgPath: "/icons/walk.svg",
    uiPosition: { x: -100, y: 150 },
  },
  carry_capacity: {
    id: "carry_capacity",
    name: "Carry Capacity",
    description: "Increases the maximum weight the player can carry.",
    maxRank: 3,
    requiredLevel: 5,
    costPerRank: [99, 99, 99],
    prerequisites: ["basic_strength"],
    effectsPerRank: createRankedStatEffect("carryCapacity", [5, 10, 15]), // +5, +10, +15 total
    iconSvgPath: "/icons/weight.svg",
    uiPosition: { x: 100, y: 150 },
  },
  resilience: {
    id: "resilience",
    name: "Resilience",
    description: "Increases physical damage reduction.",
    maxRank: 3,
    requiredLevel: 5,
    costPerRank: [1, 2, 3],
    prerequisites: ["toughness"],
    effectsPerRank: createRankedStatEffect(
      "damageReduction",
      [0.04, 0.08, 0.12]
    ), // +4%, +8%, +12% total
    iconSvgPath: "/icons/bear-head.svg",
    uiPosition: { x: 0, y: 150 },
  },

  // Not yet implemented to learn skills, costs set to 99 for now.
  // --- Tier 3 (Level 10+) ---
  // Skills that only unlock abilities don't need the helper
  primal_armor: {
    id: "primal_armor",
    name: "Primal Armor",
    description: "Unlocks the Den Mother defensive ability.",
    maxRank: 1,
    requiredLevel: 10,
    costPerRank: [99], // Temporary
    prerequisites: ["resilience"],
    effectsPerRank: [
      // Define manually for single rank/unlock
      { unlockAbility: "den_mother" },
    ],
    iconSvgPath: "/icons/bear-head.svg",
    uiPosition: { x: 0, y: 250 },
  },
  inner_fire: {
    id: "inner_fire",
    name: "Inner Fire",
    description: "Unlocks the Inner Warmth ability.",
    maxRank: 1,
    requiredLevel: 10,
    costPerRank: [99],
    prerequisites: ["cold_acclimation"],
    effectsPerRank: [{ unlockAbility: "warmth" }],
    iconSvgPath: "/icons/fire-shield.svg",
    uiPosition: { x: -100, y: 250 },
  },
};

/** Helper function to get skill data by ID */
export function getSkillNodeData(nodeId) {
  return SKILL_TREE_CONFIG[nodeId] || null;
}

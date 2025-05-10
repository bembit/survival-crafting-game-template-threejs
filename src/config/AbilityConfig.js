// src/config/AbilitiesConfig.js
// Settings for abilities
import { PLAYER_CONFIG } from "./PlayerConfig.js";

export const ABILITIES = {
  // Melee - increased damage and range
  culling_strike: {
    id: "culling_strike",
    name: "Culling Strike",
    type: "targeted_attack",
    iconPlaceholder: "HV",
    iconSvgPath: "/icons/winged-sword.svg",
    cooldownSeconds: 10,
    description: "A powerful melee strike, dealing 150% damage.",
    // Effect-specific data
    damageMultiplier: 1.5,
    range: PLAYER_CONFIG.ATTACK_RANGE + 1.5,
  },
  // Buff - reduced damage taken
  den_mother: {
    id: "den_mother",
    name: "Den Mother",
    type: "self_buff",
    iconPlaceholder: "DM",
    iconSvgPath: "/icons/bear-head.svg",
    cooldownSeconds: 45,
    durationSeconds: 10,
    description:
      "Channel primal resilience, temporarily reducing damage taken by 25%.",
    // Effect-specific data
    damageReductionBonus: 0.25, // 25%
  },
  // Buff - Increased cold resistance
  warmth: {
    id: "warmth",
    name: "Inner Warmth",
    type: "self_buff",
    iconPlaceholder: "WM",
    iconSvgPath: "/icons/fire-shield.svg",
    cooldownSeconds: 300,
    durationSeconds: 70,
    description:
      "Focus your inner heat to resist the cold temporarily. +25% Cold Resistance",
    // Define a custom effect property
    coldResistanceBonus: 0.25,
  },
  // Buff - Reduced enemy perception / agro range
  // Expose enemy perceptions and reduce them by X% ? (Later...)
  // Ranged/Other placeholder
  // tracker: {
  //   id: "tracker",
  //   name: "tracker",
  //   type: "self_buff",
  //   iconPlaceholder: "WM",
  //   cooldownSeconds: 5,
  //   durationSeconds: 15,
  //   description: "Focus your inner heat to resist the cold temporarily.",
  //   // this could reduce the enemy perception range
  // },
  // Buff - Increased movement speed
  swiftness: {
    id: "swiftness",
    name: "Swiftness",
    type: "self_buff",
    iconPlaceholder: "SW",
    iconSvgPath: "/icons/running-ninja.svg",
    cooldownSeconds: 30,
    durationSeconds: 3,
    description: "Testing Zoom Zoom speed bonus.",
    speedBonus: 10,
    // speedBonus: PLAYER_CONFIG.WALK_SPEED + 10 && PLAYER_CONFIG.RUN_SPEED + 10,
  },
};

// Helper function to get ability data by ID
export function getAbilityData(abilityId) {
  return ABILITIES[abilityId] || null;
}

// src/config/CraftingConfig.js
// Crafting recipes settings

export const CRAFTING_RECIPES = {
  // Key is the itemId of the output item
  bandage: {
    outputItemId: "bandage",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 6 },
      // { itemId: "wood_log", quantity: 4 },
      // { itemId: "stone", quantity: 1 },
    ],
    iconSvgPath: "/icons/bandage-roll.svg",
  },
  heavy_bandage: {
    outputItemId: "heavy_bandage",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 6 },
      // { itemId: "iron_ore", quantity: 2 },
      { itemId: "flower_3", quantity: 1 },
    ],
    iconSvgPath: "/icons/bandage-roll.svg",
  },
  super_bandage: {
    outputItemId: "super_bandage",
    outputQuantity: 1,
    ingredients: [
      { itemId: "mushroom_common", quantity: 2 },
      { itemId: "flower_3", quantity: 3 },
    ],
    iconSvgPath: "/icons/health-potion.svg",
  },
  campfire_kit: {
    outputItemId: "campfire_kit",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 6 },
      { itemId: "stone", quantity: 4 },
    ],
    iconSvgPath: "/icons/campfire.svg",
  },
  rope: {
    outputItemId: "rope",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 4 },
      { itemId: "stone", quantity: 2 },
      // { itemId: "mushroom_common", quantity: 1 },
    ],
    iconSvgPath: "/icons/rope-coil.svg",
  },

  makeshift_helmet: {
    outputItemId: "makeshift_helmet",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 6 },
      // { itemId: "iron_ore", quantity: 1 },
      // { itemId: "stone", quantity: 1 },
    ],
    iconSvgPath: "/icons/light-helm.svg",
  },
  makeshift_gloves: {
    outputItemId: "makeshift_gloves",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 6 },
      // { itemId: "iron_ore", quantity: 1 },
      // { itemId: "stone", quantity: 1 },
    ],
    iconSvgPath: "/icons/gloves.svg",
  },
  makeshift_chest: {
    outputItemId: "makeshift_chest",
    outputQuantity: 1,
    ingredients: [
      { itemId: "wood_log", quantity: 8 },
      // { itemId: "flower_3", quantity: 1 },
      { itemId: "rope", quantity: 1 },
      // { itemId: "cloth_scrap", quantity: 2 },
    ],
    iconSvgPath: "/icons/scale-mail.svg",
  },

  makeshift_legs: {
    outputItemId: "makeshift_legs",
    outputQuantity: 1,
    ingredients: [
      // { itemId: "cloth_scrap", quantity: 2 },
      { itemId: "wood_log", quantity: 8 },
      // { itemId: "flower_3", quantity: 1 },
      { itemId: "rope", quantity: 1 },
    ],
    iconSvgPath: "/icons/armored-pants.svg",
  },

  makeshift_feet: {
    outputItemId: "makeshift_feet",
    outputQuantity: 1,
    ingredients: [
      // { itemId: "cloth_scrap", quantity: 1 },
      // { itemId: "leather_strip", quantity: 1 },
      { itemId: "wood_log", quantity: 6 },
    ],
    iconSvgPath: "/icons/steeltoe-boots.svg",
  },

  makeshift_bag: {
    outputItemId: "makeshift_bag",
    outputQuantity: 1,
    ingredients: [
      // { itemId: "cloth_scrap", quantity: 3 },
      // { itemId: "rope", quantity: 1 },
      { itemId: "wood_log", quantity: 6 },
    ],
    iconSvgPath: "/icons/knapsack.svg",
  },

  makeshift_weapon: {
    outputItemId: "makeshift_weapon",
    outputQuantity: 1,
    ingredients: [
      { itemId: "iron_ore", quantity: 2 },
      { itemId: "wood_log", quantity: 4 },
    ],
    iconSvgPath: "/icons/stick-grenade.svg",
  },

  stone_axe: {
    outputItemId: "stone_axe",
    outputQuantity: 1,
    ingredients: [
      { itemId: "stone", quantity: 2 },
      { itemId: "wood_log", quantity: 4 },
      { itemId: "iron_ore", quantity: 4 },
      { itemId: "rope", quantity: 1 },
    ],
    iconSvgPath: "/icons/war-pick.svg",
    weight: 3.0,
    statsBonus: {
      damage: 1,
    },
  },
  // more later: pickaxe: { ... }
  // this could increase the effectiveness of gathering resources. feels useless atm since we scale speed of gathering by damage
};

// Helper to get recipe data
export function getRecipeData(outputItemId) {
  return CRAFTING_RECIPES[outputItemId] || null;
}

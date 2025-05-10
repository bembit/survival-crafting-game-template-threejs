// src/config/ItemConfig.js
// Items and consumables config

export const ITEMS = {
  wood_log: {
    id: "wood_log",
    name: "Wood Log",
    description:
      "A sturdy log, good for building and fuel. Currently also for crafting clothes.",
    weight: 1.5, // Weight per item
    maxStack: 8, // Max items per inventory slot
    modelPath: "primitive://cylinder", // Path for visual when dropped (or actual model path)
    iconImagePath: "/icons/log.svg", // Icon to use in UI
  },

  stone: {
    id: "stone",
    name: "Stone",
    description: "A chunk of rock.",
    weight: 2.0,
    maxStack: 4,
    modelPath: "primitive://icosahedron",
    iconImagePath: "/icons/stone-block.svg",
  },

  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    description: "Contains iron.",
    weight: 3.0,
    maxStack: 2,
    modelPath: "primitive://icosahedron",
    iconImagePath: "/icons/ore.svg",
  },

  flower_3: {
    id: "flower_3",
    name: "Blue Petal Flower",
    description: "A vibrant blue flower. Can be used for medicine.",
    weight: 0.1,
    maxStack: 5,
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/lotus-flower.svg",
  },

  mushroom_common: {
    id: "mushroom_common",
    name: "Common Mushroom",
    description:
      "An earthy mushroom. Can be used for medicine. I think. I don't quite remember.",
    weight: 0.2,
    maxStack: 5,
    modelPath: "/models/nature/Mushroom_Common.gltf",
    iconImagePath: "/icons/mushroom.svg",
  },

  bandage: {
    id: "bandage",
    name: "Simple Bandage",
    description: "Restores a small amount of health.",
    weight: 0.1,
    maxStack: 5,
    type: "consumable", // <<< Mark as consumable
    healAmount: 15,
    modelPath: "/models/nature/Flower_3_Single.gltf", // Or primitive
    iconImagePath: "/icons/bandage-roll.svg",
  },

  heavy_bandage: {
    id: "heavy_bandage",
    name: "Heavy Bandage",
    description: "Restored a moderate amount of health.",
    weight: 0.1,
    maxStack: 3,
    type: "consumable",
    healAmount: 25,
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/bandage-roll.svg",
  },

  super_bandage: {
    id: "super_bandage",
    name: "Super Duper Endgame Bandage",
    description:
      "I ain't got time to bleed. Has a health potion icon. But it is not a potion.",
    weight: 0.1,
    maxStack: 3,
    type: "consumable",
    healAmount: 50,
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/health-potion.svg",
  },

  campfire_kit: {
    id: "campfire_kit",
    name: "Campfire Kit",
    description:
      "A basic campfire that offers protection from the harsh effects of the weather. Use to place it.",
    weight: 5.0,
    maxStack: 1,
    type: "placeable",
    placeableId: "campfire",
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/campfire.svg",
  },

  rope: {
    id: "rope",
    name: "Rope",
    description:
      "A sturdy rope, good for building and climbing. Or for crafting clothes. Really?",
    weight: 4.0,
    maxStack: 3,
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/rope-coil.svg",
  },

  makeshift_helmet: {
    id: "makeshift_helmet",
    name: "Makeshift Helmet",
    description: "Offers minimal protection from weather.",
    weight: 1.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "head",
    statsBonus: {
      maxHealth: 5,
      coldResistance: 0.05,
      damageReduction: 0.02,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/light-helm.svg",
  },

  makeshift_gloves: {
    id: "makeshift_gloves",
    name: "Makeshift Gloves",
    description: "Offers minimal protection from weather.",
    weight: 1.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "gloves",
    statsBonus: {
      maxHealth: 5,
      coldResistance: 0.05,
      damageReduction: 0.02,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/gloves.svg",
  },

  makeshift_chest: {
    id: "makeshift_chest",
    name: "Makeshift Jacket",
    description: "A tattered jacket that keeps some warmth in.",
    weight: 2.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "chest",
    statsBonus: {
      maxHealth: 10,
      coldResistance: 0.1,
      damageReduction: 0.05,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/scale-mail.svg",
  },

  makeshift_legs: {
    id: "makeshift_legs",
    name: "Makeshift Pants",
    description: "Worn-out pants offering basic coverage.",
    weight: 1.5,
    maxStack: 1,
    type: "equipment",
    equipSlot: "legs",
    statsBonus: {
      maxHealth: 10,
      coldResistance: 0.07,
      damageReduction: 0.03,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/armored-pants.svg",
  },

  makeshift_feet: {
    id: "makeshift_feet",
    name: "Makeshift Boots",
    description: "Improvised boots that barely keep your feet dry.",
    weight: 1.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "feet",
    statsBonus: {
      coldResistance: 0.05,
      damageReduction: 0.02,
      speed: 0.2,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/steeltoe-boots.svg",
  },

  makeshift_bag: {
    id: "makeshift_bag",
    name: "Makeshift Bag",
    description:
      "A flimsy bag stitched from scraps. Would add some carry space if implemented.",
    weight: 0.8,
    maxStack: 1,
    type: "equipment",
    equipSlot: "bag",
    statsBonus: {
      maxHealth: 5,
      coldResistance: 0.05,
      // carryCapacity: 5, // Not implemented yet
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/knapsack.svg",
  },

  makeshift_weapon: {
    id: "makeshift_weapon",
    name: "Makeshift Weapon",
    description: "A bent piece of rock on a stick. Better than bare hands.",
    weight: 3.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "weapon",
    statsBonus: {
      damage: 1,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/stick-grenade.svg",
  },

  stone_axe: {
    id: "stone_axe",
    name: "Stone Axe",
    description: "A sturdy axe made from stone.",
    weight: 3.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "weapon",
    statsBonus: {
      damage: 5,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/war-pick.svg",
  },

  // Testing/Dev
  sword_of_the_thousand_truths: {
    id: "sword_of_the_thousand_truths",
    name: "Sword of the Thousand Truths",
    description: "Mom! Bathroom!",
    weight: 1.0,
    maxStack: 1,
    type: "equipment",
    equipSlot: "weapon",
    statsBonus: {
      damage: 999,
      coldResistance: 1,
      maxHealth: 300,
      damageReduction: 1,
      speed: 2,
    },
    modelPath: "/models/nature/Flower_3_Single.gltf",
    iconImagePath: "/icons/sword-wound.svg",
  },
};

/** Helper function to get item data by ID */
export function getItemData(itemId) {
  return ITEMS[itemId] || null; // Return null if item ID is invalid
}

// src/config/EnemiesConfig.js
// Enemies stats, loot and behavior settings

export const ENEMIES = {
  wolf_timber: {
    id: "wolf_timber",
    name: "Timber Wolf", // For UI/logs
    modelConfig: {
      // Info for ResourceManager
      path: "/models/animals/Wolf.gltf", // Use your actual path
      scale: 0.5, // Adjust as needed
      normalizeHeight: 1, // Optional: Target height
    },
    // physicsConfig: {
    //   shape: "box",
    //   // --- Provide HALF-EXTENTS ---
    //   hx: 0.3, // Half-width (Total width = 0.8)
    //   hy: 1, // Half-height (Total height = 1.0)
    //   hz: 0.8, // Half-length (Total length = 1.4)
    //   // --- End Half-Extents ---
    //   mass: 40,
    //   friction: 0.6, // Maybe slightly higher friction for a box to resist sliding
    //   restitution: 0.1, // Low bounciness
    // },
    physicsConfig: {
      shape: "capsule", // Use capsule
      radius: 0.85, // Similar width to player capsule radius
      height: 0.5, // Total height of the capsule (similar to player)
      hy: 1.35, // Half-height (Total height = 1.0)
      // hx: 2,
      // hz: 1.5,
      mass: 75, // Slightly heavier than player
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      // Info for StatsComponent
      health: 75,
      damage: 8,
      speed: 3, // Base movement speed
      runSpeed: 4.5, // Chase speed
      attackRange: 1.5,
      attackCooldown: 1.8, // Seconds between attacks
      perceptionRange: 10.0, // How far it can "see" the player
      // Add defense, resistances etc. later
    },
    animations: {
      // Map state names to animation clip names in the GLB
      idle: "Idle_2", // Actual clip names from wolf model
      walk: "Walk",
      run: "Gallop",
      attack: "Attack",
      hurt: "Idle_HitReact1", // Reaction anim - Unused
      death: "Death",
    },
    ai: {
      // Basic parameters for AI behavior
      behavior: "aggressive_melee", // Predefined AI type
      wanderRadius: 15.0, // How far it wanders from spawn
      chaseDistance: 25.0, // Max distance to chase before giving up
      attackDistance: 1.8, // Distance within which it tries to attack
      // Not implemented yet.
      fleeHealthPercent: 0.1, // Flee below 10% health
    },
    lootTable: [
      // Ideal loot table
      // { itemId: "wolf_pelt", quantity: 1, chance: 0.75 },
      // { itemId: "raw_meat", quantity: [1, 2], chance: 0.9 },
      {
        itemId: "flower_3", // Unique ID for loot type
        quantity: 1,
        chance: 1.0, // Drop chance (1.0 = 100%)
        // Optional/Test: Add model path here if needed, or handle it in EnemyManager
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
    ],
    xpValue: 50, // Experience gain
  },
  wolf_dire: {
    id: "wolf_dire",
    name: "Dire Wolf",
    modelConfig: {
      path: "/models/animals/Husky.gltf",
      scale: 0.5,
      normalizeHeight: 1,
    },
    physicsConfig: {
      shape: "capsule",
      radius: 0.85,
      height: 0.5,
      hy: 1.35,
      mass: 75,
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      health: 100,
      damage: 15,
      speed: 1,
      runSpeed: 2.5,
      attackRange: 1.5,
      attackCooldown: 1.8,
      perceptionRange: 12.0,
    },
    animations: {
      idle: "Idle_2",
      walk: "Walk",
      run: "Gallop",
      attack: "Attack",
      hurt: "Idle_HitReact1",
      death: "Death",
    },
    ai: {
      behavior: "aggressive_melee",
      wanderRadius: 15.0,
      chaseDistance: 25.0,
      attackDistance: 1.8,
      fleeHealthPercent: 0.1,
    },
    lootTable: [
      {
        itemId: "mushroom_common",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Mushroom_Common.gltf",
      },
    ],
    xpValue: 85,
  },
  witch: {
    id: "witch",
    name: "Witch",
    modelConfig: {
      path: "/models/characters/Witch.gltf",
      scale: 1,
      normalizeHeight: 1,
    },
    physicsConfig: {
      shape: "capsule",
      radius: 0.35,
      height: 1.8,
      hy: 1,
      mass: 75,
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      health: 50,
      damage: 30,
      speed: 1.5,
      runSpeed: 2.5,
      attackRange: 4.5,
      attackCooldown: 1.5,
      perceptionRange: 20.0,
    },
    animations: {
      idle: "Idle",
      walk: "Walk",
      run: "Run",
      attack: "Kick_Right",
      hurt: "HitRecieve",
      death: "Death",
    },
    ai: {
      behavior: "aggressive_melee",
      wanderRadius: 15.0,
      chaseDistance: 25.0,
      attackDistance: 1.8,
      fleeHealthPercent: 0.1,
    },
    lootTable: [
      {
        itemId: "mushroom_common",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Mushroom_Common.gltf",
      },
    ],
    xpValue: 150,
  },
  rogueknight: {
    id: "rogueknight",
    name: "Rogue Knight",
    modelConfig: {
      path: "/models/characters/Medieval.gltf",
      scale: 1,
      normalizeHeight: 1,
    },
    physicsConfig: {
      shape: "capsule",
      radius: 0.35,
      height: 1.8,
      hy: 1,
      mass: 75,
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      health: 225,
      damage: 5,
      speed: 2,
      runSpeed: 3.5,
      attackRange: 3,
      attackCooldown: 1.6,
      perceptionRange: 15.0,
    },
    animations: {
      idle: "Idle",
      walk: "Walk",
      run: "Run",
      attack: "Sword_Slash",
      hurt: "HitRecieve",
      death: "Death",
    },
    ai: {
      behavior: "aggressive_melee",
      wanderRadius: 15.0,
      chaseDistance: 25.0,
      attackDistance: 1.8,
      fleeHealthPercent: 0.1,
    },
    lootTable: [
      {
        itemId: "flower_3",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Mushroom_Common.gltf",
      },
    ],
    xpValue: 250,
  },
  horsie: {
    id: "horsie",
    name: "Mr. Kek",
    modelConfig: {
      path: "/models/animals/Donkey.gltf",
      scale: 0.5,
      normalizeHeight: 1,
    },
    physicsConfig: {
      shape: "capsule",
      radius: 0.85,
      height: 0.5,
      hy: 1.35,
      mass: 75,
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      health: 40,
      damage: 0.1,
      speed: 6,
      runSpeed: 10.5,
      attackRange: 1.5,
      attackCooldown: 1.8,
      perceptionRange: 1.0,
    },
    animations: {
      idle: "Idle_2",
      walk: "Walk",
      run: "Gallop",
      attack: "Attack",
      hurt: "Idle_HitReact1",
      death: "Death",
    },
    ai: {
      behavior: "aggressive_melee",
      wanderRadius: 3.0,
      chaseDistance: 1.0,
      attackDistance: 1.8,
      fleeHealthPercent: 0.1,
    },
    lootTable: [
      {
        itemId: "flower_3",
        quantity: 3,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "mushroom_common",
        quantity: 3,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "super_bandage",
        quantity: 3,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "makeshift_chest",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "makeshift_legs",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "makeshift_gloves",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "makeshift_helmet",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "makeshift_feet",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "makeshift_bag",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
      {
        itemId: "sword_of_the_thousand_truths",
        quantity: 1,
        chance: 1.0,
        modelPath: "/models/nature/Flower_3_Single.gltf",
      },
    ],
    xpValue: 30000000,
  },
  stag: {
    id: "stag",
    name: "Stag",
    modelConfig: {
      path: "/models/animals/Stag.gltf",
      scale: 0.5,
      normalizeHeight: 1,
    },
    physicsConfig: {
      shape: "capsule",
      radius: 0.85,
      height: 0.5,
      hy: 1.35,
      mass: 75,
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      health: 400000,
      damage: 0.1,
      speed: 6,
      runSpeed: 10.5,
      attackRange: 1.5,
      attackCooldown: 1.8,
      perceptionRange: 1.0,
    },
    animations: {
      idle: "Idle_2",
      walk: "Walk",
      run: "Gallop",
      attack: "Attack",
      hurt: "Idle_HitReact1",
      death: "Death",
    },
    ai: {
      behavior: "aggressive_melee",
      wanderRadius: 3.0,
      chaseDistance: 1.0,
      attackDistance: 1.8,
      fleeHealthPercent: 0.1,
    },
    lootTable: [
      // { itemId: "wolf_pelt", quantity: 1, chance: 0.75 },
      // { itemId: "raw_meat", quantity: [1, 2], chance: 0.9 },
    ],
    xpValue: 1,
  },
  deer: {
    id: "deer",
    name: "Deer",
    modelConfig: {
      path: "/models/animals/Deer.gltf",
      scale: 0.5,
      normalizeHeight: 1,
    },
    physicsConfig: {
      shape: "capsule",
      radius: 0.85,
      height: 0.5,
      hy: 1.35,
      mass: 75,
      friction: 0.5,
      restitution: 0.0,
    },
    stats: {
      health: 400000,
      damage: 0.1,
      speed: 6,
      runSpeed: 10.5,
      attackRange: 1.5,
      attackCooldown: 1.8,
      perceptionRange: 1.0,
    },
    animations: {
      idle: "Idle_2",
      walk: "Walk",
      run: "Gallop",
      attack: "Attack",
      hurt: "Idle_HitReact1",
      death: "Death",
    },
    ai: {
      behavior: "aggressive_melee",
      wanderRadius: 3.0,
      chaseDistance: 1.0,
      attackDistance: 1.8,
      fleeHealthPercent: 0.1,
    },
    lootTable: [
      // { itemId: "wolf_pelt", quantity: 1, chance: 0.75 },
      // { itemId: "raw_meat", quantity: [1, 2], chance: 0.9 },
    ],
    xpValue: 1,
  },
};

export function getEnemyData(enemyId) {
  return ENEMIES[enemyId] || null;
}

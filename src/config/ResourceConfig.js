// src/config/ResourceConfig.js

// --- Resource Node Definitions ---
// This might be refactored to loot table later
// Define different types of nodes we can generate/place

// --- Unused --- Old mesh generated, from primitives / No models version.
// export const RESOURCE_NODE_CONFIGS = [
//   {
//     id: "pine_tree", // Unique ID for this node type
//     name: "Pine Tree",
//     visualType: "generatedTree", // Tells InstancedManager how to draw it
//     count: 300,
//     areaSize: 350, // Placement parameters
//     // Visual generation parameters
//     baseTrunkHeight: 3,
//     baseLeavesHeight: 5,
//     baseWidth: 0.6,
//     scaleVariance: 0.4,
//     // Physics parameters
//     createPhysics: true,
//     physicsShape: "cylinder",
//     // Component Data
//     isInteractable: true,
//     interactionType: "cuttable",
//     initialHealth: 75,
//     resourceId: "wood_log",
//     resourceQty: 3,
//   },
//   {
//     id: "rock_pile",
//     name: "Rock Pile",
//     visualType: "generatedRock", // New type for InstancedManager
//     count: 100,
//     areaSize: 325, // Place fewer rocks, maybe different area
//     // Visual generation parameters
//     baseRadius: 0.8,
//     scaleVariance: 0.5,
//     segments: 8, // Rocks are simpler
//     // Physics parameters
//     createPhysics: true,
//     physicsShape: "sphere", // Simple sphere collider for pile
//     // Component Data
//     isInteractable: true,
//     interactionType: "mineable",
//     initialHealth: 100,
//     resourceId: "stone",
//     resourceQty: 4,
//   },
//   {
//     id: "iron_vein",
//     name: "Iron Vein",
//     visualType: "generatedRock", // Can reuse rock generator with different material/color?
//     count: 55,
//     areaSize: 300,
//     baseRadius: 1.0,
//     scaleVariance: 0.2,
//     segments: 6,
//     color: 0x555555, // Greyer color
//     createPhysics: true,
//     physicsShape: "sphere",
//     isInteractable: true,
//     interactionType: "mineable",
//     initialHealth: 125,
//     resourceId: "iron_ore",
//     resourceQty: 2,
//   },
// ];

export const RESOURCE_NODE_CONFIGS = [
  {
    id: "pine_tree", // Unique ID for this node type
    name: "Pine Tree",
    // visualType: "generatedTree",
    modelPath: "/models/nature/Pine_4.gltf",
    count: 250,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.4, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 100,
    resourceId: "wood_log",
    resourceQty: 3,
  },
  {
    id: "pine_tree_2", // Unique ID for this node type
    name: "Pine Tree",
    // visualType: "generatedTree",
    modelPath: "/models/nature/Pine_2.gltf",
    count: 100,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.4, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 100,
    resourceId: "wood_log",
    resourceQty: 3,
  },
  {
    id: "pine_tree_3", // Unique ID for this node type
    name: "Pine Tree",
    // visualType: "generatedTree",
    modelPath: "/models/nature/Pine_5.gltf",
    count: 100,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.4, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 100,
    resourceId: "wood_log",
    resourceQty: 3,
  },
  {
    id: "dead_tree", // Unique ID for this node type
    name: "Dead Tree",
    // visualType: "generatedTree",
    modelPath: "/models/nature/DeadTree_1.gltf",
    count: 15,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.4, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 80,
    resourceId: "wood_log",
    resourceQty: 2,
  },
  {
    id: "dead_tree_2", // Unique ID for this node type
    name: "Dead Tree",
    // visualType: "generatedTree",
    modelPath: "/models/nature/DeadTree_3.gltf",
    count: 15,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.3, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 80,
    resourceId: "wood_log",
    resourceQty: 2,
  },
  {
    id: "dead_tree_3", // Unique ID for this node type
    name: "Dead Tree",
    // visualType: "generatedTree",
    modelPath: "/models/nature/DeadTree_5.gltf",
    count: 15,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.5, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 80,
    resourceId: "wood_log",
    resourceQty: 2,
  },
  {
    id: "bush_common", // Unique ID for this node type
    name: "Common Bush",
    // visualType: "generatedTree",
    modelPath: "/models/nature/Bush_Common_Flowers.gltf",
    count: 150,
    areaSize: 350, // Placement parameters
    // Physics Calculation:
    baseTrunkHeight: 4,
    baseLeavesHeight: 5, // Not directly used in physics, but kept for context
    baseWidth: 0.6,
    // ---
    scaleVariance: 0.5, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "cylinder", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "cuttable",
    initialHealth: 40,
    resourceId: "wood_log",
    resourceQty: 1,
  },
  {
    id: "rock_pile",
    name: "Rock Pile",
    // visualType: "generatedRock",
    modelPath: "/models/nature/Rock_Medium_1.gltf",
    count: 250,
    areaSize: 325, // Place fewer rocks, maybe different area
    // Physics Calculation:
    baseRadius: 1,
    segments: 8, // Not used for physics, can be removed
    // ---
    scaleVariance: 0.5, // Visual variety
    // Physics parameters
    createPhysics: true,
    physicsShape: "sphere", // Keep original physics shape
    // Component Data
    isInteractable: true,
    interactionType: "mineable",
    initialHealth: 100,
    resourceId: "stone",
    resourceQty: 4,
  },
  {
    id: "iron_vein",
    name: "Iron Vein",
    // visualType: "generatedRock",
    modelPath: "/models/nature/Rock_Medium_2.gltf",
    count: 55,
    areaSize: 300,
    // Physics Calculation:
    baseRadius: 0.8,
    scaleVariance: 0.2,
    segments: 6, // Not used for physics, can be removed
    // color: 0x555555, // Color info now comes from the model
    // ---
    createPhysics: true,
    physicsShape: "sphere", // Keep original physics shape
    isInteractable: true,
    interactionType: "mineable",
    initialHealth: 120,
    resourceId: "iron_ore",
    resourceQty: 2,
  },
  {
    id: "grass_patch", // Unique ID
    name: "Grass Patch",
    modelPath: "/models/nature/Grass_Common_Short.gltf",
    // Note: Multiple Grass Variants
    // Can't render multiple models in a single instanced mesh.
    // modelVariants: [
    // { path: "/models/nature/Grass_Common_Short.gltf", weight: 10 },
    // { path: "/models/nature/Pebble_Round_5.gltf", weight: 3 },
    // { path: "/models/nature/Grass_Wispy_Short.gltf", weight: 2 },
    // ],
    count: 3000,
    areaSize: 400, // Spread (match terrain size)
    scaleVariance: 0.4, // Randomize size
    alignToNormal: true, // <<< Custom flag: Tell InstancedManager to align grass to terrain slope
    createPhysics: false, // <<< IMPORTANT: Grass usually doesn't need physics
    // --- No physics properties needed if createPhysics is false for now. ---
    // --- No component data needed (not interactable/resource yet) ---
  },
];

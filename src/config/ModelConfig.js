// src/config/ModelConfig.js
// Model and animation settings
// For player / main Catwoman model
export const ANIM_NAMES = {
  IDLE: "stand",
  WALK: "walk",
  RUN: "run",
  JUMP: "jumpUp",
  FALL: "jumpDown",
  LAND: "land", // Could be used if model has a landing animation
  ATTACK: "punch",
};

// normalize models to this height. moved from SCENE_CONFIG to it's own constant. used by Game.js
export const DEFAULT_MODEL_NORMALIZE_TARGET_HEIGHT = 3.0;

export const PLAYER_MODEL_CONFIG = {
  path: "/models/characters/catwoman.glb",
  position: { x: 0, y: 0, z: 0 },
  scale: 1, // Initial scale set here, then normalized
  isPlayer: true,
};

// --- Testing values and model configs ---
// kept for static model assets for later use
export const STATIC_MODEL_CONFIGS = [
  // Disabled for now.
];

// these would need. EnvironmentSetup.js
// custom physics box.
// rotation, scale, position
// so math for Y would be + highest terrain point at sides?

// calc for 400 area size = 200 * 2 = 400
const posNr = 185;
export const ENV_MODEL_CONFIGS = [
  {
    path: "/models/environment/Mountain_Group_2.gltf",
    position: { x: posNr, y: 0, z: posNr },
    scale: 15,
    rotation: { x: 0, y: 0, z: 0 },
    needsPhysics: false,
    isInteractable: false,
  },
  {
    path: "/models/environment/Mountain_Group_2.gltf",
    position: { x: -posNr, y: 0, z: -posNr },
    scale: 15,
    rotation: { x: 0, y: 0, z: 0 },
    needsPhysics: false,
    isInteractable: false,
  },
  {
    path: "/models/environment/Mountain_Single.gltf",
    position: { x: -posNr, y: 0, z: posNr },
    scale: 15,
    rotation: { x: 0, y: 0, z: 0 },
    needsPhysics: false,
    isInteractable: false,
  },
  {
    path: "/models/environment/MountainLarge_Single.gltf",
    position: { x: posNr, y: 0, z: -posNr },
    scale: 15,
    rotation: { x: 0, y: 0, z: 0 },
    needsPhysics: false,
    isInteractable: false,
  },
  // {
  //   path: "/models/environment/Mine.gltf",
  //   position: { x: -posNr - 3, y: 0, z: posNr - 1 },
  //   scale: 15,
  //   rotation: { x: 0, y: 2.7, z: 0 },
  //   needsPhysics: true,
  //   isInteractable: false,
  // },
  {
    path: "/models/environment/Storage_FirstAge_Level2.gltf",
    position: { x: posNr - 15, y: 0, z: -posNr - 5 },
    scale: 15,
    rotation: { x: 0.2, y: 0.2, z: 0.2 },
    needsPhysics: true,
    isInteractable: false,
  },
  // {
  //   path: "/models/environment/Logs.gltf",
  //   position: { x: 15, y: 0, z: 15 },
  //   scale: 15,
  //   rotation: { x: 0, y: 0, z: 0 },
  //   needsPhysics: true,
  //   isInteractable: false,
  // },
  // {
  //   path: "/models/environment/Farm_SecondAge_Level1.gltf",
  //   position: { x: 15, y: 0, z: -15 },
  //   scale: 15,
  //   rotation: { x: 0, y: 0, z: 0 },
  //   needsPhysics: true,
  //   isInteractable: false,
  // },
];

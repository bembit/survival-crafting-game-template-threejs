// src/config/PlayerConfig.js
// Player config settings

import { Vector3 } from "three";

export const PLAYER_CONFIG = {
  GRAVITY: -19.6, // Used for jump impulse calculation (match PhysicsEngine gravity).
  JUMP_HEIGHT: 1.8, // The desired peak height of the jump (units).

  ROTATION_SPEED: 0.15, // Visual rotation smoothing factor.

  ANIM_FADE_DURATION: 0.2, // Animation crossfade duration.

  MODEL_FORWARD_DIRECTION: new Vector3(0, 0, 1), // Model's default forward.
  MOVEMENT_INPUT_THRESHOLD: 0.001, // Minimum velocity squared for rotation.

  TREE_FALL_MASS: 50, // Mass assigned to falling trees
  // GROUND_STICK_VELOCITY: -0.5, // Small negative velocity to apply when grounded // Removed - letting physics handle Y on ground

  ATTACK_RANGE: 1.5, // How far the attack raycast reaches
  ATTACK_DAMAGE: 20, // Damage per hit
  ATTACK_COOLDOWN: 1.3, // Attack cooldown

  WALK_SPEED: 3, // Player movement speed when walking (units per second).
  RUN_SPEED: 6, // Player movement speed when sprinting (units per second).
  HEALTH: 100, // Player health
};

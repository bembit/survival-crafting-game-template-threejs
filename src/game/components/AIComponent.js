// src/game/components/AIComponent.js

export const AI_STATES = {
  IDLE: "IDLE",
  WANDERING: "WANDERING",
  CHASING: "CHASING",
  ATTACKING: "ATTACKING",
  FLEEING: "FLEEING", // Placeholder
  DEAD: "DEAD",
};

export class AIComponent {
  /** @type {string} Current state from AI_STATES */
  currentState = AI_STATES.IDLE;
  /** @type {THREE.Object3D | null} Current target entity (e.g., the player) */
  targetEntity = null;
  /** @type {number} Timer for actions like attacking */
  actionTimer = 0;
  /** @type {boolean} Flag to signal animation system to play attack */
  triggerAttack = false;

  // Wandering Properties
  /** @type {THREE.Vector3 | null} Current destination for wandering */
  wanderTargetPosition = null;
  /** @type {number} How far the enemy can wander from its current position */
  wanderRadius = 5.0;
  /** @type {number} Timer until picking a new wander target */
  wanderTimer = 0;
  /** @type {number} Min duration for wandering towards a target */
  minWanderDuration = 3.0;
  /** @type {number} Max duration for wandering towards a target */
  maxWanderDuration = 7.0;
  /** @type {number} Min duration for idling */
  minIdleDuration = 2.0;
  /** @type {number} Max duration for idling */
  maxIdleDuration = 5.0;

  constructor() {
    this.currentState = AI_STATES.IDLE;
    this.targetEntity = null;
    this.actionTimer =
      Math.random() * (this.maxIdleDuration - this.minIdleDuration) +
      this.minIdleDuration;

    this.triggerAttack = false;
    // Add damage tracking flags here if not already present from previous steps
    this.damageAppliedThisAttack = false;
    this.attackDamageTimer = null;

    // Initialize Wander Properties
    this.wanderTargetPosition = null;
    this.wanderTimer = 0;
  }

  setState(newState) {
    if (this.currentState !== newState) {
      const previousState = this.currentState;
      this.currentState = newState;
      // Reset specific timers/flags when entering certain states
      this.triggerAttack = false; // Always reset this trigger

      if (newState === AI_STATES.IDLE) {
        // Set a timer for how long to remain idle
        this.actionTimer =
          Math.random() * (this.maxIdleDuration - this.minIdleDuration) +
          this.minIdleDuration;
        this.wanderTargetPosition = null; // Clear wander target when going idle
        this.wanderTimer = 0;
      } else if (newState === AI_STATES.WANDERING) {
        // Timer for wandering duration will be set when a target is picked
        this.actionTimer = 0; // Reset action timer (used for attacking)
      } else if (newState === AI_STATES.ATTACKING) {
        // Cooldown timer is set in AISystem when entering attacking
        this.wanderTargetPosition = null; // Clear wander target
        this.wanderTimer = 0;
      } else if (newState === AI_STATES.CHASING) {
        this.actionTimer = 0; // Reset action timer
        this.wanderTargetPosition = null; // Clear wander target
        this.wanderTimer = 0;
      }
    }
  }
}

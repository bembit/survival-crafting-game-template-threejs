// src/game/animation/PlayerAnimationFSM.js
import * as THREE from "three";
import { PLAYER_CONFIG } from "../config/PlayerConfig.js"; // config for fade duration
import { ANIM_NAMES } from "../config/ModelConfig.js";

// Define possible animation states
const STATES = {
  IDLE: "IDLE",
  WALK: "WALK",
  RUN: "RUN",
  JUMP: "JUMP",
  FALL: "FALL",
  LAND: "LAND",
  ATTACK: "ATTACK",
};

/**
 * Manages player animation state transitions and playback.
 */
export class PlayerAnimationFSM {
  /** @type {Object.<string, THREE.AnimationAction>} Map of available animation actions. */
  _actions;
  /** @type {string} The current animation state (e.g., STATES.IDLE). */
  _currentState;
  /** @type {THREE.AnimationAction | null} The currently playing THREE.js action. */
  _currentAction = null;

  /**
   * @param {Object.<string, THREE.AnimationAction>} actions - The map of animation actions from the player's model.
   */
  constructor(actions) {
    this._actions = actions;
    // Find the initial action (Idle) and play it instantly
    const initialAction = this._actions[ANIM_NAMES.IDLE];
    if (!initialAction) {
      console.error("PlayerAnimationFSM: Idle animation not found!");
      this._currentState = "UNKNOWN";
    } else {
      this._currentState = STATES.IDLE;
      this._currentAction = initialAction;
      this._currentAction.play();
    }
    console.log(
      "PlayerAnimationFSM initialized. Initial state:",
      this._currentState
    );
  }

  /**
   * Enters a new animation state, handling crossfading.
   * @param {string} newState - The target state name (from STATES enum).
   */
  _enterState(newState) {
    if (!this._actions) return;
    const newStateNameString = newState; // e.g., "WALK"
    // Find the corresponding animation clip name from ANIM_NAMES config
    const newActionClipName = Object.keys(ANIM_NAMES).find(
      (key) => key === newStateNameString
    );
    const newActionName = newActionClipName
      ? ANIM_NAMES[newActionClipName]
      : null;

    if (!newActionName) {
      console.warn(
        `PlayerAnimationFSM: No clip name found in ANIM_NAMES for state: ${newState}`
      );
      return;
    }

    const newAction = this._actions[newActionName];

    if (!newAction) {
      console.warn(
        `PlayerAnimationFSM: Animation action "${newActionName}" not found for state ${newState}.`
      );
      return;
    }

    // Don't transition to the same state
    if (this._currentAction === newAction) {
      return;
    }

    // console.log(`FSM Transition: ${this._currentState} -> ${newState}`); // Log transition

    const previousAction = this._currentAction;
    this._currentState = newState;
    this._currentAction = newAction;

    // Handle crossfade
    if (previousAction && previousAction !== newAction) {
      // Handle specific fade-out cases if needed (like instant stop for LAND)
      if (
        this.hasLandAnimation &&
        previousAction === this.actions[this.animNames.LAND]
      ) {
        previousAction.stop(); // Stop land anim instantly
      } else {
        previousAction.fadeOut(PLAYER_CONFIG.ANIM_FADE_DURATION);
      }
    }

    // Configure and play the new action
    newAction
      .reset()
      .setEffectiveWeight(1.0)
      .fadeIn(PLAYER_CONFIG.ANIM_FADE_DURATION)
      .play();

    // Handle non-looping animations
    if (newState === STATES.ATTACK || newState === STATES.LAND) {
      // Add land if available
      newAction.clampWhenFinished = true;
      newAction.loop = THREE.LoopOnce;
      // We might need to know when these finish to transition back to Idle/Walk
      // TODO: Use AnimationMixer 'finished' event listener?
    } else {
      newAction.clampWhenFinished = false;
      newAction.loop = THREE.LoopRepeat;
    }
  }

  /**
   * Determines the correct animation state based on player conditions.
   * @param {object} context - Player state information.
   * @param {boolean} context.onGround
   * @param {boolean} context.isMoving
   * @param {boolean} context.isSprinting
   * @param {boolean} context.isJumping - PlayerController's flag (in air, includes falling)
   * @param {boolean} context.isFalling - Specific falling state (negative Y velocity, not on ground)
   * @param {boolean} context.justLanded
   * @param {boolean} context.isAttacking
   * @param {boolean} context.justJumped - Flagged for the frame jump impulse is applied
   */
  update(context) {
    // Determine target state based on priority (Attack > Jump/Fall/Land > Run > Walk > Idle)
    let nextState = this._currentState;

    if (context.isAttacking) {
      // Only enter attack state if not already attacking (prevents interrupting itself)
      // Or allow interrupting other states to attack?
      nextState = STATES.ATTACK;
    } else if (context.justLanded) {
      // Only transition to LAND if it exists, otherwise handled by onGround logic
      nextState = this.hasLandAnimation
        ? STATES.LAND
        : context.isMoving
        ? context.isSprinting
          ? STATES.RUN
          : STATES.WALK
        : STATES.IDLE;
    } else if (context.justJumped) {
      // This happens right after impulse, FSM will quickly transition based on next frame's state
      nextState = STATES.JUMP;
    } else if (context.isFalling) {
      // Only transition to FALL if it exists
      nextState = this.hasFallAnimation ? STATES.FALL : STATES.JUMP; // Fallback to JUMP anim if no FALL
    } else if (context.isJumping) {
      // Still moving upwards or at peak
      nextState = STATES.JUMP;
    } else if (context.onGround) {
      if (context.isMoving) {
        nextState = context.isSprinting ? STATES.RUN : STATES.WALK;
      } else {
        nextState = STATES.IDLE;
      }
    }
    // Fallback if somehow no state determined
    // else { nextState = STATES.IDLE; }

    // Transition to the new state if it's different
    if (nextState !== this._currentState) {
      this._enterState(nextState);
    }

    // Handle non-looping animations finishing
    // A better way is using the AnimationMixer 'finished' event
    if (
      (this._currentState === STATES.ATTACK ||
        this._currentState === STATES.LAND) &&
      this._currentAction &&
      !this._currentAction.isRunning()
    ) {
      console.log(`FSM: Non-looping action ${this._currentState} finished.`);
      // Force transition back to a default ground state after non-looping anim ends
      const defaultState = context.isMoving
        ? context.isSprinting
          ? STATES.RUN
          : STATES.WALK
        : STATES.IDLE;
      this._enterState(defaultState);
    }
  }

  // Helper properties to check if optional animations exist (FSM needs this info)
  get hasFallAnimation() {
    return !!this._actions[ANIM_NAMES.FALL];
  }
  get hasLandAnimation() {
    return !!this._actions[ANIM_NAMES.LAND];
  }
}

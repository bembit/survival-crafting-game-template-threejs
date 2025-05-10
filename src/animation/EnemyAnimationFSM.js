// src/animation/EnemyAnimationFSM.js
import * as THREE from "three";
import { AI_STATES } from "../game/components/AIComponent.js";

// Basic FSM structure
export class EnemyAnimationFSM {
  _actions = {}; // Map animation names (e.g., 'idle') to THREE.AnimationAction
  _mixer;
  _currentState = "idle"; // Default state name
  _currentAction = null;
  _animationMap = {}; // Mapping from AI state (e.g., 'IDLE') to clip name (e.g., 'Idle_Anim')

  constructor(mixer, actions, animationMap) {
    this._mixer = mixer;
    this._actions = actions;
    this._animationMap = animationMap; // e.g., { idle: 'Idle_Anim', walk: 'Walk_Anim' }

    // Find and play initial animation (Idle)
    const initialClipName = this._animationMap["idle"];
    if (initialClipName && this._actions[initialClipName]) {
      this._currentState = "idle";
      this._currentAction = this._actions[initialClipName];
      this._currentAction.play();
    } else {
      console.warn(
        "Enemy FSM: Could not find initial 'idle' animation:",
        initialClipName
      );
      // Fallback to first available action
      const firstAction = Object.values(this._actions)[0];
      if (firstAction) {
        this._currentAction = firstAction;
        this._currentAction.play();
      }
    }
  }

  _enterState(newStateName) {
    const newClipName = this._animationMap[newStateName.toLowerCase()]; // Map state name to clip name
    if (!newClipName) {
      console.warn(
        `Enemy FSM: No animation clip mapped for state: ${newStateName}`
      );
      return;
    }

    const newAction = this._actions[newClipName];
    if (!newAction) {
      console.warn(`Enemy FSM: Animation action not found: ${newClipName}`);
      return;
    }

    if (this._currentAction === newAction) return; // Already in this state/animation

    // console.log(
    //   `Enemy FSM: ${this._currentState} -> ${newStateName} (Clip: ${newClipName})`
    // );

    const previousAction = this._currentAction;
    this._currentState = newStateName.toLowerCase(); // Store state name consistently
    this._currentAction = newAction;

    // Basic Crossfade
    if (previousAction) {
      previousAction.fadeOut(0.3);
    }

    newAction.reset().setEffectiveWeight(1.0).fadeIn(0.3).play();

    // // Determine the correct AI state string associated with this animation key
    // // This is slightly reversed logic, assuming newStateName is 'idle', 'attack', etc.
    // let associatedAiState = AI_STATES.IDLE; // Default
    // for (const [stateKey, animKey] of Object.entries(AI_STATES)) {
    //   // Find the AI_STATE key (e.g., 'ATTACKING') whose mapped animation name matches newStateName
    //   if (this._animationMap[animKey.toLowerCase()] === newClipName) {
    //     associatedAiState = stateKey; // e.g., AI_STATES.ATTACKING
    //     break;
    //   }
    // }

    // // Handle looping based on the *intended* AI state logic
    // if (
    //   associatedAiState === AI_STATES.ATTACKING ||
    //   associatedAiState === AI_STATES.DEAD
    // ) {
    //   newAction.setLoop(THREE.LoopOnce, 1);
    //   newAction.clampWhenFinished = true;
    // } else {
    //   newAction.setLoop(THREE.LoopRepeat);
    //   newAction.clampWhenFinished = false;
    // }
    // Determine the AI state based on the *new state name* being entered
    let isDeathOrAttackState = false;
    if (newStateName.toLowerCase() === "attack") {
      isDeathOrAttackState = true;
      // Find corresponding AI_STATE key if needed for complex logic later
    } else if (newStateName.toLowerCase() === "death") {
      isDeathOrAttackState = true;
    }

    // Handle looping based on the *intended* AI state logic
    if (isDeathOrAttackState) {
      console.log(
        `[${
          this._mixer?.getRoot().name
        }] Setting ${newStateName} animation to LoopOnce.`
      );
      newAction.setLoop(THREE.LoopOnce, 1);
      newAction.clampWhenFinished = true;
    } else {
      newAction.setLoop(THREE.LoopRepeat);
      newAction.clampWhenFinished = false;
    }
  }

  /**
   * Updates the animation state based on AI context.
   * @param {object} context - Provided by AI system (e.g., { aiState: 'CHASING', triggerAttack: false })
   */
  update(context) {
    // --- Simplified Death State Handling ---
    // If the FSM's current state is 'death', do absolutely nothing else.
    // Let LoopOnce handle the animation stopping.
    if (this._currentState === "death") {
      // Optional: Add an explicit stop() only if isRunning becomes false, as a safeguard.
      // No longer needed.
      // if (this._currentAction && !this._currentAction.isRunning()) {
      //   // console.log(
      //   //   `[${
      //   //     this._mixer?.getRoot().name
      //   //   }] FSM: Death animation finished isRunning check.`
      //   // );
      //   // this._currentAction.stop();
      // }
      // return; // Exit update immediately if in death state.
    }
    // --- End Death State Handling ---
    let nextStateName = "idle"; // Default animation key

    // 1. Determine the TARGET animation key based purely on the current AI context
    switch (context.aiState) {
      case AI_STATES.IDLE:
        nextStateName = "idle";
        break;
      case AI_STATES.WANDERING:
        nextStateName = context.isMoving ? "walk" : "idle";
        break;
      case AI_STATES.CHASING:
        nextStateName = "run";
        break;
      case AI_STATES.ATTACKING:
        // If the AI says ATTACKING, the target animation should be 'attack'
        // We will handle interrupting below if needed.
        nextStateName = "attack";
        break;
      case AI_STATES.DEAD:
        nextStateName = "death";
        break;
      default:
        nextStateName = "idle";
    }

    // Override with attack if AI triggered it this frame, forcing an attack start/restart
    // Check if the target animation isn't already attack to prevent instant restart loops
    if (context.triggerAttack && nextStateName !== "attack") {
      console.log(
        "FSM: AI TriggerAttack received, setting next state to attack."
      );
      nextStateName = "attack";
    }

    // --- Transition Logic ---

    // 2. Check if the context demands a state CHANGE.
    if (nextStateName !== this._currentState) {
      const targetClipName = this._animationMap[nextStateName];
      // Check if the target animation exists
      if (targetClipName && this._actions[targetClipName]) {
        // console.log(
        //   `FSM Context demands change: ${this._currentState} -> ${nextStateName}`
        // );
        // Force transition to the state dictated by the context
        this._enterState(nextStateName);
        return; // Transition initiated, done for this update cycle.
      } else {
        console.warn(
          `Enemy FSM: Cannot transition, animation clip for target key "${nextStateName}" not found or mapped.`
        );
        // Attempt to fallback to idle if the intended animation is missing
        if (this._currentState !== "idle" && this._animationMap["idle"]) {
          this._enterState("idle");
          return;
        }
      }
    }

    // // 3. If no state change was demanded by context, THEN check if a non-looping animation has finished naturally.
    // //    This allows attack/death to play fully *unless* interrupted by a context change above.
    // if (
    //   (this._currentState === "attack" || this._currentState === "death") &&
    //   this._currentAction &&
    //   !this._currentAction.isRunning() // Check if finished AFTER checking context demand
    // ) {
    //   console.log(
    //     `FSM: Non-looping action ${this._currentState} finished naturally.`
    //   );
    //   // Animation finished, determine the state based on CURRENT AI context *now*
    //   let fallbackStateName = "idle"; // Default after finishing attack/death
    //   switch (
    //     context.aiState // Re-evaluate context *after* anim finishes
    //   ) {
    //     case AI_STATES.IDLE:
    //       fallbackStateName = "idle";
    //       break;
    //     case AI_STATES.WANDERING:
    //       fallbackStateName = context.isMoving ? "walk" : "idle";
    //       break;
    //     case AI_STATES.CHASING:
    //       fallbackStateName = "run";
    //       break;
    //     // ATTACKING/DEAD shouldn't be the state here if the anim just finished naturally
    //     default:
    //       fallbackStateName = "idle";
    //   }
    //   console.log(`FSM: Transitioning to fallback state: ${fallbackStateName}`);
    //   this._enterState(fallbackStateName); // Transition to appropriate state after completion
    // }
    // // If we reach here, either the state hasn't changed, or a looping animation is playing correctly.
  } // End update()
}

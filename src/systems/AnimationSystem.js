// src/systems/AnimationSystem.js
import * as THREE from "three";

/**
 * Manages and updates all THREE.AnimationMixer instances in the game.
 */
export class AnimationSystem {
  /** @type {Set<THREE.AnimationMixer>} */
  mixers;

  constructor() {
    this.mixers = new Set();
    console.log("AnimationSystem initialized");
  }

  /**
   * Registers an AnimationMixer to be updated by the system.
   * Typically called after a model with animations is loaded.
   * @param {THREE.AnimationMixer} mixer - The mixer instance to register.
   */
  registerMixer(mixer) {
    if (!mixer) {
      console.warn("Attempted to register an invalid mixer.");
      return;
    }
    if (this.mixers.has(mixer)) {
      console.warn("Mixer already registered.");
      return;
    }
    this.mixers.add(mixer);
    // console.log("Mixer registered. Total mixers:", this.mixers.size);
  }

  /**
   * Unregisters an AnimationMixer. Call this when the associated object is removed.
   * @param {THREE.AnimationMixer} mixer - The mixer instance to unregister.
   */
  unregisterMixer(mixer) {
    if (this.mixers.has(mixer)) {
      this.mixers.delete(mixer);
      // console.log("Mixer unregistered. Total mixers:", this.mixers.size);
    } else {
      console.warn("Attempted to unregister a mixer that was not found.");
    }
  }

  /**
   * Updates all registered AnimationMixers with the time delta.
   * Should be called once per frame in the main game loop.
   * @param {number} delta - Time elapsed since the last frame (seconds).
   */
  update(delta) {
    this.mixers.forEach((mixer) => {
      mixer.update(delta);
    });
  }
}

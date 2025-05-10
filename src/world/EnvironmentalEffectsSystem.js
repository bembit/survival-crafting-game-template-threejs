// src/world/EnvironmentalEffectSystem.js
import * as THREE from "three"; // Need THREE for Color and MathUtils
import eventBus from "../core/EventBus.js";
import { mulberry32, cyrb128 } from "../utils/PRNG.js";
import { SCENE_CONFIG } from "../config/SceneConfig.js";

// --- Effect Type Enum ---
export const EffectType = {
  NONE: "none",
  // DARK_NIGHT: "dark_night",
  FOG: "fog",
  // BLOOD_MOON: "blood_moon",
};

// --- Configuration ---
const EFFECT_CONFIG = {
  // [EffectType.DARK_NIGHT]: {
  //   weight: 3,
  //   minDuration: 5,
  //   maxDuration: 5,
  //   targetLightMultipliers: { sun: 0.01, ambient: 0.02, moon: 0.05 }, // Target multipliers (relative to base)
  //   targetSkyColor: new THREE.Color(0x010103), // Target sky color
  //   targetAmbientColor: new THREE.Color(0x000000), // Target ambient color
  // },
  [EffectType.FOG]: {
    weight: 5,
    minDuration: 25,
    maxDuration: 35,
    fogType: "linear", // 'linear' or 'exp2'
    fogColor: new THREE.Color(0x556677), // Use THREE.Color
    fogNear: 2.5,
    fogFar: 35, // For linear
    // fogDensity: 0.03, // For exp2
  },
  // [EffectType.BLOOD_MOON]: {
  //   /* tbi */
  // },
  [EffectType.NONE]: { weight: 5 },
};

const MIN_INTERVAL_SECONDS = 25;
const MAX_INTERVAL_SECONDS = 38;
const EFFECT_TRANSITION_DURATION = 10; // 255; // <<< Duration for fade in/out (seconds)

export class EnvironmentalEffectsSystem {
  sceneManager;
  random;
  activeEffects = new Set();
  effectEndTimers = new Map();
  nextChangeCheckTimer = 0;

  // Transition State Properties ---
  isTransitioning = false;
  transitionProgress = 0; // 0.0 to 1.0

  // Target values for smooth interpolation
  targetFog = null; // { type, color, near, far, density } or null
  targetLightMultipliers = { sun: 1.0, ambient: 1.0, moon: 1.0 };
  targetSkyColor = null; // THREE.Color or null (null means use normal day/night cycle color)

  // Current interpolated values (applied each frame)
  currentFog = null; // { type, color, near, far, density } or null
  // Set currentFog to actual hidden fog state
  // currentFog = new THREE.Fog(0xcccccc, 10, 35);

  currentLightMultipliers = { sun: 1.0, ambient: 1.0, moon: 1.0 };
  currentSkyColor = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR); // Start with default day

  currentSkyColor = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR);
  // Store the color at the start of a transition
  startSkyColor = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR);
  // Store base intensities to calculate multipliers correctly
  baseAmbientIntensity = SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY; // Assuming you have access or pass it in
  // Add near top of class
  targetAmbientColor = null; // THREE.Color or null
  currentAmbientColor = new THREE.Color(SCENE_CONFIG.AMBIENT_LIGHT_COLOR); // Start with default ambient
  startAmbientColor = new THREE.Color(SCENE_CONFIG.AMBIENT_LIGHT_COLOR);

  constructor(sceneManager, enemyManager, environmentSeed) {
    this.sceneManager = sceneManager;
    const numericSeed = cyrb128(String(environmentSeed + "_effects"));
    this.random = mulberry32(numericSeed);

    // Initialize current values from defaults
    // Ensure initial colors are set
    this.currentSkyColor.setHex(SCENE_CONFIG.SKYBOX_COLOR);
    this.startSkyColor.setHex(SCENE_CONFIG.SKYBOX_COLOR);

    this._scheduleNextChangeCheck();
    console.log(`EnvironmentalEffectsSystem initialized. Seed: ${numericSeed}`);
    // No event listeners needed here now, Game loop will poll current values
  }

  _scheduleNextChangeCheck() {
    this.nextChangeCheckTimer =
      MIN_INTERVAL_SECONDS +
      this.random() * (MAX_INTERVAL_SECONDS - MIN_INTERVAL_SECONDS);
    console.log(this.nextChangeCheckTimer);
  }

  isEffectActive(effectType) {
    return this.activeEffects.has(effectType);
  }

  /**
   * Update timers and trigger effect changes.
   * @param {number} delta - Time since last frame.
   * @param {boolean} isNightTime - Flag indicating if it's currently night in the game. <<<
   */
  update(delta, isNightTime) {
    // 1. Update effect end timers and trigger _endEffect for expired ones
    const endedEffects = [];
    this.effectEndTimers.forEach((timer, effect) => {
      const newTimer = timer - delta;
      if (newTimer <= 0) {
        endedEffects.push(effect);
      } else {
        this.effectEndTimers.set(effect, newTimer);
      }
    });
    endedEffects.forEach((effect) => this._endEffect(effect)); // _endEffect now sets targets

    // 2. Update transition progress and interpolated values
    if (this.isTransitioning) {
      this.transitionProgress += delta / EFFECT_TRANSITION_DURATION;
      this.transitionProgress = Math.min(1.0, this.transitionProgress);

      // --- Interpolate Light Multipliers ---
      this.currentLightMultipliers.sun = THREE.MathUtils.lerp(
        this.currentLightMultipliers.sun,
        this.targetLightMultipliers.sun,
        this.transitionProgress
      );
      this.currentLightMultipliers.ambient = THREE.MathUtils.lerp(
        this.currentLightMultipliers.ambient,
        this.targetLightMultipliers.ambient,
        this.transitionProgress
      );
      this.currentLightMultipliers.moon = THREE.MathUtils.lerp(
        this.currentLightMultipliers.moon,
        this.targetLightMultipliers.moon,
        this.transitionProgress
      );

      // --- Interpolate Sky Color ---
      // If targetSkyColor is null, we should be fading towards the *current* normal day/night color.
      // This is complex to handle perfectly here. Let's simplify: Game.js will handle the final color blend.
      // We only provide the target override color, or null. Game.js lerps towards it or default.
      // So, no currentSkyColor lerping needed here.

      // --- Interpolate Ambient Color ---
      const defaultAmbientColor = new THREE.Color(
        SCENE_CONFIG.AMBIENT_LIGHT_COLOR
      ); // Need a default reference
      const effectiveTargetAmbient =
        this.targetAmbientColor || defaultAmbientColor; // Target override or default
      this.currentAmbientColor
        .copy(this.startAmbientColor)
        .lerp(effectiveTargetAmbient, this.transitionProgress);

      // Snap at end of transition
      if (this.transitionProgress >= 1.0) {
        // ... snap other values ...
        this.currentAmbientColor.copy(effectiveTargetAmbient); // Snap final ambient color
      }

      // --- Sky Color Interpolation ---
      const defaultSky = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR);
      // Determine the actual target color (the dark color OR the default sky blue)
      const effectiveTargetSky = this.targetSkyColor || defaultSky;

      // Lerp the currentSkyColor FROM the startSkyColor TOWARDS the effectiveTargetSky
      // The .lerp() method modifies the color it's called on.
      this.currentSkyColor
        .copy(this.startSkyColor)
        .lerp(effectiveTargetSky, this.transitionProgress);
      // Add logging here to check the interpolation:
      // console.log(`Sky Lerp: Progress=${this.transitionProgress.toFixed(2)}, Start=${this.startSkyColor.getHexString()}, Target=${effectiveTargetSky.getHexString()}, Current=${this.currentSkyColor.getHexString()}`);
      // --- Interpolate Fog ---
      this._updateCurrentFog(delta);

      // Check if transition finished
      if (this.transitionProgress >= 1.0) {
        this.isTransitioning = false;
        // Snap to final values
        this.currentLightMultipliers = { ...this.targetLightMultipliers };
        this.currentFog = this.targetFog
          ? { ...this.targetFog, color: this.targetFog.color.clone() }
          : null;
      }
    }

    // 3. Apply Fog based on CURRENT interpolated state
    this._applyCurrentFogSettings();

    // 4. Check if time to trigger a new potential change
    this.nextChangeCheckTimer -= delta;
    if (this.nextChangeCheckTimer <= 0) {
      this._triggerEffectChange(isNightTime);
      this._scheduleNextChangeCheck();
    }
  }

  // Helper to manage fog interpolation
  _updateCurrentFog(delta) {
    const progress = this.transitionProgress; // Use current transition progress

    if (!this.targetFog && this.currentFog) {
      // Fading Out
      if (this.currentFog.type === "linear") {
        // Fade out by increasing near and far distances rapidly
        this.currentFog.near = THREE.MathUtils.lerp(
          this.currentFog.near,
          this.currentFog.far * 1.5,
          progress * 2
        ); // Faster fade out
        this.currentFog.far = THREE.MathUtils.lerp(
          this.currentFog.far,
          this.currentFog.far * 2,
          progress * 2
        );
      } else if (this.currentFog.type === "exp2") {
        this.currentFog.density = THREE.MathUtils.lerp(
          this.currentFog.density,
          0,
          progress
        );
      }
      this.currentFog.color.lerp(
        new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR),
        progress
      ); // Fade color towards sky
      if (progress >= 1.0) this.currentFog = null; // Remove when faded
    } else if (this.targetFog && !this.currentFog) {
      // Fading In
      // Initialize currentFog at the start of the fade-in
      this.currentFog = { ...this.targetFog, color: new THREE.Color() }; // Start with temp color
      if (this.currentFog.type === "linear") {
        this.currentFog.near = this.targetFog.far; // Start near at the far distance
        this.currentFog.far = this.targetFog.far; // Keep far constant during fade-in? Or lerp too?
      } else {
        // exp2
        this.currentFog.density = 0; // Start density at 0
      }
      this.currentFog.color.copy(this.targetFog.color).multiplyScalar(0); // Start color black? Or target color? Let's use target

      // Now lerp towards target (this block runs every frame during fade-in)
      if (this.currentFog.type === "linear") {
        this.currentFog.near = THREE.MathUtils.lerp(
          this.targetFog.far,
          this.targetFog.near,
          progress
        ); // Lerp near from far to target near
        this.currentFog.far = this.targetFog.far; // Keep far fixed? Or lerp if needed
      } else {
        // exp2
        this.currentFog.density = THREE.MathUtils.lerp(
          0,
          this.targetFog.density,
          progress
        ); // Lerp density from 0 to target
      }
      this.currentFog.color.lerpColors(
        new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR),
        this.targetFog.color,
        progress
      ); // Lerp color from sky
    } else if (this.targetFog && this.currentFog) {
      // Changing between fog types or parameters
      // Lerp color
      this.currentFog.color.lerpColors(
        this.currentFog.color,
        this.targetFog.color,
        progress
      );

      // Lerp parameters (handle type change potentially by snapping or cross-fading)
      if (this.currentFog.type === this.targetFog.type) {
        if (this.currentFog.type === "linear") {
          this.currentFog.near = THREE.MathUtils.lerp(
            this.currentFog.near,
            this.targetFog.near,
            progress
          );
          this.currentFog.far = THREE.MathUtils.lerp(
            this.currentFog.far,
            this.targetFog.far,
            progress
          );
        } else {
          // exp2
          this.currentFog.density = THREE.MathUtils.lerp(
            this.currentFog.density,
            this.targetFog.density,
            progress
          );
        }
      } else {
        // Simple snap for now if types change during transition (could improve later)
        if (progress > 0.5) {
          this.currentFog = {
            ...this.targetFog,
            color: this.targetFog.color.clone(),
          };
        }
      }
    }
  }

  // Helper to apply current fog settings to the scene
  _applyCurrentFogSettings() {
    if (this.currentFog) {
      if (
        !this.sceneManager.scene.fog || // No fog exists OR
        (this.currentFog.type === "linear" &&
          !(this.sceneManager.scene.fog instanceof THREE.Fog)) || // Type mismatch
        (this.currentFog.type === "exp2" &&
          !(this.sceneManager.scene.fog instanceof THREE.FogExp2))
      ) {
        // Type mismatch
        // Create new fog instance if needed
        if (this.currentFog.type === "linear") {
          this.sceneManager.scene.fog = new THREE.Fog(
            this.currentFog.color,
            this.currentFog.near,
            this.currentFog.far
          );
        } else {
          // exp2
          this.sceneManager.scene.fog = new THREE.FogExp2(
            this.currentFog.color,
            this.currentFog.density
          );
        }
      } else {
        // Update existing fog parameters
        this.sceneManager.scene.fog.color.copy(this.currentFog.color);
        if (this.currentFog.type === "linear") {
          this.sceneManager.scene.fog.near = this.currentFog.near;
          this.sceneManager.scene.fog.far = this.currentFog.far;
        } else {
          // exp2
          this.sceneManager.scene.fog.density = this.currentFog.density;
        }
      }
    }
    // else {
    // // Ensure fog is disabled if no currentFog
    // if (this.sceneManager.scene.fog) {
    //   this.sceneManager.scene.fog = null;
    //   this.currentFog.near = THREE.MathUtils.lerp(
    //     this.currentFog.near,
    //     this.currentFog.far * 1.5,
    //     progress * 2
    //   );
    // }
    // }
  }

  /**
   * Decides whether to start or stop an effect, considering time of day for specific effects.
   * @param {boolean} isNightTime - Flag indicating if it's currently night.
   */
  _triggerEffectChange(isNightTime) {
    const totalWeight = Object.values(EFFECT_CONFIG).reduce(
      (sum, conf) => sum + (conf.weight || 0),
      0
    );
    let randomValue = this.random() * totalWeight;
    let chosenEffect = EffectType.NONE;
    for (const type in EFFECT_CONFIG) {
      const weight = EFFECT_CONFIG[type].weight || 0;
      if (randomValue < weight) {
        chosenEffect = type;
        break;
      }
      randomValue -= weight;
    }

    console.log(`Effect Change Check Triggered. Chosen: ${chosenEffect}`);

    const currentTargetType = this._getCurrentTargetEffectType();

    // Only proceed if the chosen effect is different from the current target
    if (chosenEffect !== currentTargetType) {
      // If an effect is currently active, end it first
      if (this.activeEffects.size > 0) {
        const firstActive = this.activeEffects.values().next().value;
        if (firstActive) this._endEffect(firstActive);
      }

      // // If the chosen effect is not NONE, check conditions before starting
      // if (chosenEffect !== EffectType.NONE) {
      //   let canStartChosenEffect = true; // Assume it can start by default

      //   // --->>> TIME CHECK FOR DARK NIGHT <<<---
      //   if (chosenEffect === EffectType.DARK_NIGHT && !isNightTime) {
      //     canStartChosenEffect = false; // Cannot start Dark Night during the day
      //     console.log(`Skipping Dark Night start because it's daytime.`);
      //   }

      // Add checks for other effects if they have time restrictions
      // Example: if (chosenEffect === SomeDayEffect && isNightTime) { canStartChosenEffect = false; }

      if (!this.isEffectActive(chosenEffect)) {
        // if (canStartChosenEffect && !this.isEffectActive(chosenEffect)) {
        // Check if not already active (safety)
        this._startEffect(chosenEffect);
        // } else if (!canStartChosenEffect) {
        //   // Log if skipped due to condition, but still schedule next check (done in update)
        // }
      }
    }
  }

  // Helper to figure out the primary target effect type
  _getCurrentTargetEffectType() {
    if (this.targetFog) return EffectType.FOG;
    // if (this.targetSkyColor) return EffectType.DARK_NIGHT; // Assuming only dark night changes sky color target
    // Add check for blood moon target if needed
    return EffectType.NONE;
  }

  _startEffect(effectType) {
    const config = EFFECT_CONFIG[effectType];
    if (!config || this.activeEffects.has(effectType)) return;

    this.activeEffects.add(effectType);
    const duration =
      config.minDuration +
      this.random() * (config.maxDuration - config.minDuration);
    this.effectEndTimers.set(effectType, duration);

    // --- Set TARGET values and store START color ---
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.startSkyColor.copy(this.currentSkyColor);

    // Reset all targets before applying new ones
    this.targetFog = null;
    this.targetLightMultipliers = { sun: 1.0, ambient: 1.0, moon: 1.0 };
    this.targetSkyColor = null;

    if (effectType === EffectType.FOG) {
      this.targetFog = {
        type: config.fogType || "linear",
        color: config.fogColor
          ? config.fogColor.clone()
          : new THREE.Color(0xcccccc),
        near: config.fogNear,
        far: config.fogFar,
        density: config.fogDensity,
      };
    }
    // else if (effectType === EffectType.DARK_NIGHT) {
    //   this.targetLightMultipliers = config.targetLightMultipliers
    //     ? { ...config.targetLightMultipliers }
    //     : { sun: 0.01, ambient: 0.02, moon: 0.05 };
    //   this.targetSkyColor = config.targetSkyColor
    //     ? config.targetSkyColor.clone()
    //     : new THREE.Color(0x010103); // <<< CLONE target color
    //   this.targetAmbientColor = config.targetAmbientColor
    //     ? config.targetAmbientColor.clone()
    //     : new THREE.Color(0x1a1a2a); // <<< CLONE target color
    //   console.log(
    //     `[EffectsSystem] Setting Target Sky for Dark Night: ${this.targetSkyColor.getHexString()}`
    //   );
    // }
    // else if (effectType === EffectType.BLOOD_MOON) { /* Set blood moon targets if any */ }

    console.log(
      `%cENV EFFECT TARGET SET: ${effectType} (Duration: ${duration.toFixed(
        1
      )}s)`,
      "color: red;"
    );
  }

  _endEffect(effectType) {
    if (!this.activeEffects.has(effectType)) return;

    this.activeEffects.delete(effectType);
    this.effectEndTimers.delete(effectType);

    // --- Set TARGET values back to defaults ---
    this.isTransitioning = true;
    this.transitionProgress = 0; // Restart transition

    // Determine which targets need resetting based on the ending effect
    if (effectType === EffectType.FOG) {
      this.targetFog = null;
    }
    // if (effectType === EffectType.DARK_NIGHT) {
    //   this.targetLightMultipliers = { sun: 1.0, ambient: 1.0, moon: 1.0 };
    //   this.targetSkyColor = null;
    // }
    // if (effectType === EffectType.BLOOD_MOON) { /* Reset blood moon targets */ }

    console.log(
      `%cENV EFFECT ENDING (Targeting Defaults): ${effectType}`,
      "color: red;"
    );
  }

  getCurrentAmbientColorOverride() {
    // Similar logic to sky override getter - return currentAmbientColor if override targeted or fading out
    const defaultAmbient = new THREE.Color(SCENE_CONFIG.AMBIENT_LIGHT_COLOR);
    if (
      this.targetAmbientColor ||
      (this.isTransitioning &&
        this.currentAmbientColor &&
        !this.currentAmbientColor.equals(defaultAmbient))
    ) {
      return this.currentAmbientColor;
    }
    return null;
  }

  // --- Getters for Game Loop ---
  getCurrentLightMultipliers() {
    return this.currentLightMultipliers;
  }
  // Returns null if no override, THREE.Color if override active/transitioning
  getCurrentSkyColorOverride() {
    // Return the *current interpolated* color IF a target override exists OR if we are still fading *out* from one.
    const defaultSky = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR);
    if (
      this.targetSkyColor ||
      (this.isTransitioning &&
        this.currentSkyColor &&
        !this.currentSkyColor.equals(defaultSky))
    ) {
      // Add logging here to see what color is being returned
      // console.log(`[EffectsSystem] Returning Sky Override: ${this.currentSkyColor.getHexString()}`);
      return this.currentSkyColor; // Return the (potentially interpolated) color
    }
    // console.log("[EffectsSystem] Returning NULL for Sky Override.");
    return null; // No override active or transitioning
  }

  destroy() {
    // ... (clear maps/sets) ...
    this.activeEffects.clear();
    this.effectEndTimers.clear();
    console.log("EnvironmentalEffectsSystem destroyed.");
  }
}

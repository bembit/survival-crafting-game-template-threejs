// src/game/components/WeatherEffectComponent.js
// import { dot } from "three/tsl";
import eventBus from "../../core/EventBus.js";
import { WeatherType } from "../../world/WeatherSystem.js";

// Constants for effects
// const BLIZZARD_SLOW_AMOUNT = -1.0; // How much speed is reduced (negative)
const FREEZING_DAMAGE_PER_TICK = 2.5; // Damage per tick
const FREEZING_TICK_INTERVAL = 2.0; // Seconds between damage ticks
const BLIZZARD_SPEED_MULTIPLIER = 0.5; // Multiplier for Blizzard/Slow (0.5 = 50% speed)

// Unique IDs for weather modifiers (to help remove them later) - add boots to remove blizzard effect
const WEATHER_MODIFIER_SLOW_ID = "weather_slow";
const WEATHER_MODIFIER_FREEZE_ID = "weather_freeze_dot"; // DOT isn't a stat mod

export class WeatherEffectComponent {
  /** @type {object} Reference to the owning entity (e.g., player model) */
  ownerEntityRef = null;
  /** @type {import('./StatsComponent.js').StatsComponent | null} */
  statsComponent = null;
  /** @type {import('./HealthComponent.js').HealthComponent | null} */
  healthComponent = null;
  /** @type {import('../../ui/UIManager.js').UIManager | null} */
  uiManager = null; // Optional: For feedback

  // State for managing effects
  activeWeather = WeatherType.CLEAR;
  activeModifiers = new Map(); // Stores references to applied stat modifiers { id: modifierObject }
  dotTimer = 0;
  // dotInterval = FREEZING_TICK_INTERVAL;
  currentDotInterval = 0; // Initialize current interval

  /**
   * @param {object} ownerEntityRef - The entity this component is attached to.
   * @param {StatsComponent} statsComponent - The entity's stats component.
   * @param {HealthComponent} healthComponent - The entity's health component.
   * @param {UIManager} [uiManager] - Optional reference to the UI manager.
   */
  constructor(
    ownerEntityRef,
    statsComponent,
    healthComponent,
    uiManager = null
  ) {
    this.ownerEntityRef = ownerEntityRef;
    this.statsComponent = statsComponent;
    this.healthComponent = healthComponent;
    this.uiManager = uiManager;

    this.dotTimer = 0; // Reset DOT timer
    this.currentDotInterval = 0; // Reset DOT interval

    if (!this.statsComponent || !this.healthComponent) {
      console.error(
        "WeatherEffectComponent requires Stats and Health components!"
      );
    }

    // Listen for weather changes
    eventBus.on("weatherChanged", this.handleWeatherChange.bind(this));
    console.log(
      `WeatherEffectComponent created for ${ownerEntityRef?.name || "entity"}.`
    );
  }

  handleWeatherChange(eventData) {
    const { newWeather, details } = eventData;
    console.log(
      `${this.ownerEntityRef?.name} handling weather change to: ${newWeather}`
    );

    // --- Remove effects from previous weather ---
    this.removeActiveEffects(); // Clear old effects first

    // --- Apply effects for new weather ---
    this.activeWeather = newWeather;

    if (!this.statsComponent || !this.healthComponent) return; // Guard

    switch (newWeather) {
      case WeatherType.BLIZZARD:
        // Apply slow modifier
        if (typeof this.statsComponent.applyModifier === "function") {
          // Apply modifier with a unique ID and very long duration (acts like infinite)
          // We'll remove it manually when weather changes
          const modifier = {
            id: WEATHER_MODIFIER_SLOW_ID, // Use the ID
            stat: "speed",
            // value: BLIZZARD_SLOW_AMOUNT * (details?.intensity ?? 1.0), // Scale effect by intensity?
            type: "multiplicative",
            value: BLIZZARD_SPEED_MULTIPLIER,
            duration: 999999, // Pseudo-infinite duration
          };
          const appliedModifier = this.statsComponent.applyModifier(
            modifier.stat,
            modifier.value,
            modifier.duration,
            modifier.id,
            modifier.type
          );
          if (appliedModifier) {
            this.activeModifiers.set(modifier.id, appliedModifier); // Store the actual modifier object applied
            this.uiManager?.log("The biting wind slows you down!");
            this.uiManager?.showChatBubble(
              "Ah.. A Blizzard.. Will be tough to outrun enemies.",
              4000
            );
          }
        } else {
          console.warn("StatsComponent missing applyModifier method.");
        }

        this.currentDotInterval = FREEZING_TICK_INTERVAL * 5; // <<< Blizzard ticks less often and slows
        this.dotTimer = this.currentDotInterval; // <<< Start timer for the first tick

        break;

      // add Pitch Black type effect reducing visual clarity
      // fog?
      case WeatherType.FREEZING:
        // Start DOT timer
        this.currentDotInterval = FREEZING_TICK_INTERVAL; // <<< Use original freezing interval
        this.dotTimer = this.currentDotInterval; // <<< Start timer for the first tick
        this.uiManager?.log("The air chills you to the bone...");
        this.uiManager?.showChatBubble(
          "It's freezing, better watch out for my health and cold resistances.",
          6000
        );
        break;
      case WeatherType.CLEAR:
        this.currentDotInterval = 0;
        console.log("Clear weather effect applied.");
        this.uiManager?.log("The air is clear, and feels warmer than usual.");
        this.uiManager?.showChatBubble(
          "Finally.. the weather looks okay. For now..",
          4000
        );
        break;
      case WeatherType.RAIN: // Rain should dot but less often than freezing
        this.currentDotInterval = FREEZING_TICK_INTERVAL * 8; // <<< Rain ticks less often
        this.dotTimer = this.currentDotInterval; // <<< Start timer for the first tick
        console.log(this.dotTimer);
        console.log("Rain weather effect applied.");
        this.uiManager?.log(
          "Rain starts pouring down, your clothes are soaked."
        );
        this.uiManager?.showChatBubble(
          "It can't rain all the time. What is Catwoman doing here anyway?",
          4000
        );
        break;
      // // snow is off
      // case WeatherType.SNOW: // Snow currently has no gameplay effect
      //   console.log("Snow weather effect applied.");
      //   this.uiManager?.log(
      //     "Snow starts falling, your clothes are soaked and your feet are numb."
      //   );
      //   break;
      // // Add cases for other weather types...
    }
  }

  removeActiveEffects() {
    console.log(
      `${this.ownerEntityRef?.name} removing active weather effects.`
    );
    if (!this.statsComponent) return;

    // Remove applied modifiers
    for (const [id, modifierRef] of this.activeModifiers.entries()) {
      // Use the new removeModifierById method in StatsComponent
      const removed = this.statsComponent.removeModifierById(id);
      if (removed) {
        console.log(`Removed weather modifier: ${id}`);
        if (id === WEATHER_MODIFIER_SLOW_ID) {
          this.uiManager?.log("The wind subsides, you feel faster.");
        }
      } else {
        console.warn(`Failed to remove modifier with ID: ${id}`);
      }
    }
    this.activeModifiers.clear(); // Clear the map

    // Stop DOT
    this.dotTimer = 0;
    // this.activeWeather = WeatherType.CLEAR; // Reset internal state
  }

  update(delta) {
    if (!this.healthComponent || !this.statsComponent) return; // statsComponent check

    const isNearCampfire =
      this.ownerEntityRef?.userData?.isNearCampfire ?? false; // <<< Get the flag

    // Handle Damage Over Time (DOT) for FREEZING
    if (
      (this.activeWeather === WeatherType.FREEZING ||
        this.activeWeather === WeatherType.RAIN ||
        this.activeWeather === WeatherType.BLIZZARD) &&
      this.currentDotInterval > 0
    ) {
      this.dotTimer -= delta;

      if (this.dotTimer <= 0 && !isNearCampfire) {
        // --- Calculate Damage with Resistance ---
        let actualDamage = FREEZING_DAMAGE_PER_TICK;

        if (this.activeWeather === WeatherType.BLIZZARD) {
          actualDamage *= 0.75; // Blizzard does 75% of freezing damage per tick
        }
        if (this.activeWeather === WeatherType.RAIN) {
          actualDamage *= 0.5; // Rain does 50% of freezing damage per tick
        }

        // Get CURRENT cold resistance from the StatsComponent
        const coldResistance = this.statsComponent.currentColdResistance || 0; // <<< READ FROM STATS

        if (coldResistance > 0) {
          const damageReduction = Math.max(0, Math.min(1, coldResistance)); // Clamp 0-1
          actualDamage *= 1.0 - damageReduction; // Reduce damage
          console.log(
            `${this.ownerEntityRef?.name} Cold Resistance: ${(
              coldResistance * 100
            ).toFixed(0)}%, Damage Multiplier: ${(
              1.0 - damageReduction
            ).toFixed(2)}`
          );
        }
        actualDamage = Math.max(0, actualDamage); // Ensure damage isn't negative
        // --- End Calculation ---

        if (actualDamage > 0) {
          this.healthComponent.takeDamage(actualDamage);
          this.uiManager?.log(
            `Took ${actualDamage.toFixed(1)} freezing damage.`
          );
          console.log(
            `${this.ownerEntityRef?.name} took ${actualDamage.toFixed(
              1
            )} freezing damage.`
          );
        } else {
          this.uiManager?.log(`You resisted the freezing cold.`);
          console.log(`${this.ownerEntityRef?.name} resisted freezing damage.`);
        }

        this.dotTimer += this.currentDotInterval; // Change to current interval eg either 2 or 6 seconds ticks
      } else if (this.dotTimer <= 0 && isNearCampfire) {
        // Handle campfire warmth >>>
        this.dotTimer = this.currentDotInterval; // Reset timer
        console.log("Campfire warmth detected!");
        this.uiManager?.log("The campfire warms up, you feel warmer.");
      }
    }
  }

  // Cleanup method
  destroy() {
    eventBus.off("weatherChanged", this.handleWeatherChange.bind(this));
    this.removeActiveEffects(); // Ensure effects are cleared on destroy
    console.log(
      `WeatherEffectComponent destroyed for ${
        this.ownerEntityRef?.name || "entity"
      }.`
    );
  }
}

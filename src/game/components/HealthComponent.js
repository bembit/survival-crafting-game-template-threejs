// src/game/components/HealthComponent.js
import eventBus from "../../core/EventBus.js";
import { StatsComponent } from "./StatsComponent.js";

export class HealthComponent {
  maxHealth;
  currentHealth;
  /** @type {string|null} Unique ID of the entity owning this component */
  ownerInstanceId = null;
  /** @type {boolean} Flag to ensure death event is emitted only once */
  deathEventEmitted = false;
  /** @type {object|null} Reference to the owning entity (e.g., player model) */
  ownerEntityRef = null;
  /** @type {import('../../ui/UIManager.js').UIManager | null} */ // <<< Type Hint
  uiManager = null;

  /**
   * @param {number} maxHealth - The maximum health value.
   * @param {string|null} [ownerInstanceId=null] - Optional ID of the owning entity.
   * @param {object|null} [ownerEntityRef=null] - Optional reference to the owning entity.
   * @param {import('../../ui/UIManager.js').UIManager | null} [uiManager=null] // <<< uiManager parameter
   */
  constructor(
    maxHealth = 100,
    ownerInstanceId = null,
    ownerEntityRef = null,
    uiManager = null
  ) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
    this.ownerInstanceId = ownerInstanceId;
    this.ownerEntityRef = ownerEntityRef;
    this.uiManager = uiManager;
    this.deathEventEmitted = false;
  }

  _emitHealthChangedEvent() {
    if (this.ownerEntityRef?.userData?.isPlayer) {
      // Emit player-specific event
      eventBus.emit("playerHealthChanged", {
        target: this.ownerEntityRef,
        healthComponent: this,
      });
    } else if (this.ownerInstanceId) {
      // Check if it's likely an enemy/object
      // Emit a generic or enemy-specific event
      eventBus.emit("entityHealthChanged", {
        // Use a new event name
        instanceId: this.ownerInstanceId,
        target: this.ownerEntityRef, // Pass the reference if available
        healthComponent: this,
      });
    }
  }

  takeDamage(amount) {
    if (this.isDead() || amount <= 0) return true; // No damage or already dead

    let finalDamage = amount; // Start with incoming damage

    // --- Apply Damage Reduction ---
    const statsComp = this.ownerEntityRef?.userData?.stats;
    if (statsComp instanceof StatsComponent) {
      const reduction = Math.max(
        0,
        Math.min(0.9, statsComp.currentDamageReduction)
      );
      const multiplier = 1.0 - reduction;
      finalDamage *= multiplier;
      // console.log( // Keep internal log precise if needed
      //   `Damage Reduction Applied: ${
      //     reduction * 100
      //   }%. Original: ${amount}, Final: ${finalDamage}` // Log precise finalDamage here
      // );
    } else if (this.ownerEntityRef) {
      // ... (warning log) ...
    }
    // --- End Damage Reduction ---

    finalDamage = Math.max(0, finalDamage);

    const previousHealth = this.currentHealth;
    // Internal calculation remains precise
    this.currentHealth = Math.max(0, this.currentHealth - finalDamage);

    // --- Use Math.floor() for UI Log ---
    // this.uiManager?.log(
    //   `HealthComponent (${
    //     this.ownerInstanceId || "Unknown"
    //   }): Took ${finalDamage.toFixed(
    //     1 // Show damage taken with decimals
    //   )} final damage. Current: ${Math.floor(this.currentHealth)}/${Math.floor(
    //     // Floor display values
    //     this.maxHealth
    //   )}`
    // );

    // Internal console log can remain precise or also be floored for consistency checking
    console.log(
      `HealthComponent (${
        this.ownerInstanceId || "Unknown"
      }): Took ${finalDamage.toFixed(
        1 // Show damage taken with decimals
      )} final damage (Original: ${amount}), current (precise): ${
        this.currentHealth // Log precise internal value
      }/${this.maxHealth}`
    );

    if (previousHealth !== this.currentHealth) {
      this._emitHealthChangedEvent(); // Event still carries the precise value
    }

    const diedThisHit = this.currentHealth <= 0;

    // --- Emit Death Event ONCE ---
    if (diedThisHit && !this.deathEventEmitted && this.ownerInstanceId) {
      // ... (death event logic) ...
      if (!this.ownerEntityRef?.userData?.isPlayer) {
        console.log(
          `HealthComponent: Emitting enemyDied for ${this.ownerInstanceId}`
        );
        eventBus.emit("enemyDied", { instanceId: this.ownerInstanceId });
      } else {
        console.log(
          `HealthComponent: Player ${this.ownerInstanceId} died! (Game Over logic needed)`
        );
        eventBus.emit("playerDied", { player: this.ownerEntityRef }); // Emit player specific event
      }
      this.deathEventEmitted = true;
    }

    return diedThisHit;
  }

  heal(amount) {
    if (this.isDead() || amount <= 0) return;
    const previousHealth = this.currentHealth;

    // Internal calculation remains precise
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);

    // --- Use Math.floor() for UI Log ---
    // this.uiManager?.log(`Healed ${amount.toFixed(1)}. Current: ${Math.floor(this.currentHealth)}/${Math.floor(this.maxHealth)}`);

    // --- Internal Log ---
    console.log(
      `[HealthComponent.heal] Owner: ${
        this.ownerInstanceId
      }, Amount: ${amount.toFixed(1)}, New Current (Precise): ${
        this.currentHealth
      }`
    );

    if (previousHealth !== this.currentHealth) {
      this._emitHealthChangedEvent(); // Event carries precise value
    }
  }

  reset() {
    const previousHealth = this.currentHealth;
    this.currentHealth = this.maxHealth;
    this.deathEventEmitted = false;
    if (previousHealth !== this.currentHealth) {
      // <<< Emit if health changed on reset
      this._emitHealthChangedEvent();
    }
  }

  updateMaxHealth(newMaxHealth) {
    const oldMaxHealth = this.maxHealth;
    this.maxHealth = Math.max(1, newMaxHealth);
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth); // Clamp precise value

    // --- Use Math.floor() for UI Log ---
    console.log(
      `HealthComponent (${
        this.ownerInstanceId
      }): Max Health updated ${Math.floor(oldMaxHealth)} -> ${Math.floor(
        this.maxHealth
      )}` // Floor display values
    );
    this._emitHealthChangedEvent(); // Event carries precise value
  }

  isDead() {
    return this.currentHealth <= 0;
  }
}

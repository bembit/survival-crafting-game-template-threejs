// src/game/components/AbilityComponent.js
import { getAbilityData } from "../../config/AbilityConfig.js";

export class AbilityComponent {
  /** @type {Set<string>} Set of known ability IDs */
  knownAbilities;
  /** @type {Map<string, number>} Map of ability ID to remaining cooldown timer */
  cooldowns;

  constructor() {
    this.knownAbilities = new Set();
    this.cooldowns = new Map();
  }

  /** Learns a new ability */
  learnAbility(abilityId) {
    if (getAbilityData(abilityId) && !this.knownAbilities.has(abilityId)) {
      this.knownAbilities.add(abilityId);
      this.cooldowns.set(abilityId, 0); // Initialize cooldown to 0 (ready)
      console.log(`Learned ability: ${abilityId}`);
      // TODO: Emit event? ('abilityLearned')
    } else {
      console.warn(`Ability ${abilityId} not found or already known.`);
    }
  }

  /** Checks if an ability is ready (exists and not on cooldown) */
  isReady(abilityId) {
    return (
      this.knownAbilities.has(abilityId) &&
      (this.cooldowns.get(abilityId) || 0) <= 0
    );
  }

  /** Starts the cooldown for an ability */
  triggerCooldown(abilityId) {
    const abilityData = getAbilityData(abilityId);
    if (abilityData && this.knownAbilities.has(abilityId)) {
      this.cooldowns.set(abilityId, abilityData.cooldownSeconds);
      console.log(
        `Ability ${abilityId} triggered cooldown: ${abilityData.cooldownSeconds}s`
      );
    }
  }

  /** Updates cooldown timers. Call this every frame. */
  updateCooldowns(delta) {
    for (const [abilityId, timer] of this.cooldowns.entries()) {
      if (timer > 0) {
        this.cooldowns.set(abilityId, Math.max(0, timer - delta));
        // Optional: log when cooldown finishes
        // Show UI bubble? Or log to uiManager.log instead.
        // if (timer - delta <= 0) {
        //     console.log(`Ability ${abilityId} is off cooldown.`);
        // }
      }
    }
  }

  /** Get known abilities as an array (useful for UI) */
  getKnownAbilitiesArray() {
    return Array.from(this.knownAbilities);
  }
}

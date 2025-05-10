// src/game/components/SkillTreeComponent.js
import eventBus from "../../core/EventBus.js";
import { getSkillNodeData } from "../../config/SkillTreeConfig.js"; // Use the renamed config

export class SkillTreeComponent {
  /** @type {Map<string, number>} Map of skill ID to current rank (0 if not learned) */
  skillRanks = new Map();
  /** @type {import('./StatsComponent.js').StatsComponent | null} */
  statsRef = null;
  /** @type {import('./AbilityComponent.js').AbilityComponent | null} */
  abilityRef = null;

  constructor(statsComponentRef, abilityComponentRef) {
    this.statsRef = statsComponentRef;
    this.abilityRef = abilityComponentRef;
    // Note: No root node concept needed if Tier 1 skills have no prerequisites
    console.log("SkillTreeComponent initialized.");
  }

  /** Gets the current rank of a skill. Returns 0 if not learned. */
  getSkillRank(skillId) {
    return this.skillRanks.get(skillId) || 0;
  }

  /** Checks if a skill can be unlocked or upgraded */
  canUnlockOrUpgrade(skillId) {
    const nodeData = getSkillNodeData(skillId);
    if (!nodeData || !this.statsRef) return false; // Skill doesn't exist or missing refs

    const currentRank = this.getSkillRank(skillId);
    const maxRank = nodeData.maxRank || 1;
    const nextRank = currentRank + 1;

    // Check Max Rank
    if (currentRank >= maxRank) {
      // console.log(`Cannot upgrade ${skillId}: Already at max rank (${currentRank}/${maxRank})`);
      return false;
    }

    // Check Level Requirement
    const requiredLevel = nodeData.requiredLevel || 1;
    if (this.statsRef.level < requiredLevel) {
      // console.log(`Cannot unlock/upgrade ${skillId}: Requires Level ${requiredLevel}, Player is ${this.statsRef.level}`);
      return false;
    }

    // Check Cost
    const costArray = Array.isArray(nodeData.costPerRank)
      ? nodeData.costPerRank
      : [nodeData.costPerRank || 1];
    const costForNextRank =
      costArray[currentRank] ?? costArray[costArray.length - 1] ?? 1; // Get cost for the rank we're buying (index = currentRank)
    if (this.statsRef.availableSkillPoints < costForNextRank) {
      // console.log(`Cannot unlock/upgrade ${skillId}: Requires ${costForNextRank} points, Player has ${this.statsRef.availableSkillPoints}`);
      return false;
    }

    // Check Prerequisites
    if (nodeData.prerequisites && nodeData.prerequisites.length > 0) {
      for (const prereqId of nodeData.prerequisites) {
        // For now, just check if prerequisite is learned (rank > 0)
        // TODO: Add specific rank requirement checks if needed later
        if (this.getSkillRank(prereqId) === 0) {
          const prereqNode = getSkillNodeData(prereqId);
          // console.log(`Cannot unlock/upgrade ${skillId}: Prerequisite '${prereqNode?.name || prereqId}' not met.`);
          return false;
        }
      }
    }

    // If all checks pass
    return true;
  }

  /** Attempts to unlock or upgrade a skill */
  unlockOrUpgradeSkill(skillId) {
    if (!this.canUnlockOrUpgrade(skillId)) {
      console.warn(
        `Attempted to unlock/upgrade ${skillId}, but conditions not met.`
      );
      // Optionally emit failure event for UI feedback
      return false;
    }

    const nodeData = getSkillNodeData(skillId);
    if (!nodeData || !this.statsRef) return false; // Should be caught by canUnlockOrUpgrade, but good practice

    const currentRank = this.getSkillRank(skillId);
    const newRank = currentRank + 1;
    const costArray = Array.isArray(nodeData.costPerRank)
      ? nodeData.costPerRank
      : [nodeData.costPerRank || 1];
    const costForThisRank =
      costArray[currentRank] ?? costArray[costArray.length - 1] ?? 1;

    // 1. Deduct Skill Points
    this.statsRef.availableSkillPoints -= costForThisRank;

    // 2. Update Skill Rank
    this.skillRanks.set(skillId, newRank);
    console.log(
      `Skill '${nodeData.name}' upgraded to Rank ${newRank}. Points spent: ${costForThisRank}`
    );

    // 3. Apply Effects for the NEW Rank
    this.applySkillEffects(skillId, newRank); // Apply effects based on the *new* rank achieved

    // 4. Emit Events
    eventBus.emit("skillTreeChanged", {
      skillId: skillId,
      newRank: newRank,
      component: this,
    });
    eventBus.emit("statsChanged", { component: this.statsRef }); // For skill point UI update

    return true;
  }

  /**
   * Applies the effects of achieving a specific rank for a skill.
   * This handles applying stat bonuses or unlocking abilities.
   * @param {string} skillId - The ID of the skill.
   * @param {number} achievedRank - The rank that was just achieved (e.g., 1, 2, or 3).
   */
  applySkillEffects(skillId, achievedRank) {
    const nodeData = getSkillNodeData(skillId);
    if (!nodeData?.effectsPerRank || !this.statsRef || !this.abilityRef) return;

    const effectsForThisRank = nodeData.effectsPerRank[achievedRank - 1]; // Get effects for the achieved rank (0-indexed)
    if (!effectsForThisRank) {
      console.warn(`No effects defined for ${skillId} at Rank ${achievedRank}`);
      return;
    }

    // Ensure effects are always treated as an array
    const effectsArray = Array.isArray(effectsForThisRank)
      ? effectsForThisRank
      : [effectsForThisRank];

    console.log(
      `Applying effects for ${skillId} Rank ${achievedRank}:`,
      effectsArray
    );

    effectsArray.forEach((effect) => {
      if (effect.stat && typeof effect.value === "number") {
        // Stat bonus effect
        const statKey = effect.stat.toLowerCase();
        const bonusType = effect.type || "additive"; // Default to additive
        // Generate a unique ID for THIS specific rank's bonus application
        // const sourceId = `skill_${skillId}_rank_${achievedRank}`;
        const sourceId = `skill_${skillId}`;

        // --- Delta Application Logic ---
        // Get the value for the PREVIOUS rank (if rank > 1)
        let previousRankValue = 0;
        if (achievedRank > 1) {
          const effectsForPreviousRank =
            nodeData.effectsPerRank[achievedRank - 2];
          const previousEffectsArray = Array.isArray(effectsForPreviousRank)
            ? effectsForPreviousRank
            : [effectsForPreviousRank];
          const previousStatEffect = previousEffectsArray.find(
            (e) =>
              e.stat?.toLowerCase() === statKey &&
              (e.type || "additive") === bonusType
          );
          if (previousStatEffect) {
            previousRankValue = previousStatEffect.value;
          }
        }

        // Calculate the difference (delta) to apply
        const valueDelta = effect.value - previousRankValue;

        // Apply the DELTA using a modified approach if needed, or simply apply the new value
        // For simplicity with applyStatBonus replacing old values, just apply the new total value
        console.log(
          `-> Applying stat bonus: Source=${sourceId}, Stat=${statKey}, Value=${effect.value}, Type=${bonusType}`
        );
        this.statsRef.applyStatBonus(
          sourceId,
          statKey,
          effect.value,
          bonusType
        );
        // Note: This simple application assumes applyStatBonus *replaces* any existing bonus for the same sourceId.
        // If applyStatBonus ADDS, you would need to remove the previous rank's bonus first.
        // Let's assume applyStatBonus handles replacement based on sourceId.
      } else if (effect.unlockAbility && this.abilityRef.learnAbility) {
        // Unlock ability effect (usually only on rank 1)
        console.log(`-> Unlocking ability: ${effect.unlockAbility}`);
        this.abilityRef.learnAbility(effect.unlockAbility);
      } else {
        console.warn(
          `Unknown effect structure for ${skillId} Rank ${achievedRank}:`,
          effect
        );
      }
    });

    // Recalculate stats after all effects for this rank are applied
    this.statsRef.recalculateCurrentStats();
  }

  /** Gets the skill tree state for saving */
  getSkillTreeState() {
    return {
      // Convert Map to a plain object for JSON serialization
      skillRanks: Object.fromEntries(this.skillRanks),
    };
  }

  /** Applies loaded skill tree state */
  applySkillTreeState(state) {
    if (!state || !state.skillRanks) {
      console.warn("Invalid skill tree state provided for loading.");
      this.skillRanks.clear(); // Clear current state if load data is bad
      return;
    }

    console.log("Applying loaded skill tree state:", state.skillRanks);
    this.skillRanks.clear(); // Clear existing ranks before applying loaded ones

    // Convert loaded object back to Map
    const loadedRanksMap = new Map(Object.entries(state.skillRanks));

    // Set the ranks first
    loadedRanksMap.forEach((rank, skillId) => {
      if (typeof rank === "number" && rank > 0) {
        this.skillRanks.set(skillId, rank);
      }
    });

    // IMPORTANT: Re-apply effects for all learned skills based on their loaded rank
    console.log("Re-applying effects for loaded skill ranks...");
    this.skillRanks.forEach((rank, skillId) => {
      // Apply effects for *each rank up to the loaded rank* to ensure correct state
      // This is complex if effects aren't purely additive.
      // Let's try applying only the final rank's effect, assuming stats recalculation handles the total.
      console.log(`-- Re-applying effects for ${skillId} at Rank ${rank}`); //
      // --- Re-Apply Logic ---
      // For each learned skill, apply its final rank's effects directly.
      // StatsComponent's recalculateCurrentStats should handle summing everything correctly.
      const nodeData = getSkillNodeData(skillId); //
      if (!nodeData?.effectsPerRank) return;

      const finalEffects = nodeData.effectsPerRank[rank - 1]; //
      if (!finalEffects) return;

      const effectsArray = Array.isArray(finalEffects)
        ? finalEffects
        : [finalEffects]; //

      effectsArray.forEach((effect) => {
        if (effect.stat && typeof effect.value === "number") {
          const statKey = effect.stat.toLowerCase();
          const bonusType = effect.type || "additive";
          const sourceId = `skill_${skillId}`; // Use skill-specific ID

          this.statsRef?.applyStatBonus(
            sourceId,
            statKey,
            effect.value, // Apply the value for the final rank
            bonusType //
          );
        } else if (effect.unlockAbility) {
          this.abilityRef?.learnAbility(effect.unlockAbility); //
        }
      });
    });

    // Final recalculation after all effects are reapplied
    this.statsRef?.recalculateCurrentStats(); //
    console.log("Finished re-applying loaded skill effects."); //
    // Emit change event so UI updates if it's already open
    eventBus.emit("skillTreeChanged", { component: this, loaded: true });
  }
}

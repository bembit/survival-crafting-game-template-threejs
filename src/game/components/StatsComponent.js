// src/game/components/StatsComponent.js
import { PLAYER_CONFIG } from "../../config/PlayerConfig.js"; // Or a dedicated stats config
import eventBus from "../../core/EventBus.js";

// --- Define Leveling Curve ---
const XP_TO_LEVEL_UP = [
  0,
  100,
  250,
  450,
  700,
  1000,
  1350,
  1750,
  2200,
  2700, // Levels 1-10
  3900,
  5500,
  7500,
  10000,
  15000,
  20000,
  25000,
  30000,
  35000,
  40000,
  45000, // Levels 11-20
];
const MAX_LEVEL = XP_TO_LEVEL_UP.length - 1;

/**
 * Holds base and current stats for an entity (e.g., player, enemy).
 * Current stats can be modified by effects/abilities.
 */
export class StatsComponent {
  // --- Base Stats ---
  baseSpeed;
  baseRunSpeed;
  baseDamage;
  baseAttackRange;
  basePerceptionRange;
  baseMaxHealth; // <<< Base value
  baseDamageReduction = 0; // Base Damage Reduction (0% default)
  baseColdResistance = 0; // Base Cold Resistance (0% default)

  // --- Current Stats --- (Recalculated from base + modifiers)
  currentSpeed;
  currentRunSpeed;
  currentDamage;
  currentAttackRange;
  currentMaxHealth; // <<< Derived value
  currentDamageReduction = 0; // Current Damage Reduction
  currentColdResistance = 0; // Current Cold Resistance

  // speedMultiplier = 1.0;
  // damageMultiplier = 1.0;

  attackCooldown;
  perceptionRange; // Use current value derived from base/modifiers if needed

  entityRef = null;

  /** @type {Array<object>} List of active stat modifiers { stat, value, remainingDuration } */
  activeModifiers = [];

  // --- Leveling & XP ---
  isPlayer = false;
  level = 1;
  currentXP = 0;
  xpToNextLevel = 0;

  // Skill Points
  availableSkillPoints = 0;

  /** @type {Array<object>} List of active timed stat modifiers { id, stat, value, remainingDuration } */
  activeTimedModifiers = [];
  /** @type {Map<string, {stat: string, value: number, type?: 'additive' | 'multiplicative'}>} */ // Allow type for equip bonuses too (optional)
  equipmentBonuses = new Map(); // <<< Map for equipment bonuses

  constructor(baseStats = {}, entityRef = null, isPlayer = false) {
    // Base stats
    this.baseSpeed = baseStats.speed ?? PLAYER_CONFIG.WALK_SPEED ?? 5;
    this.baseRunSpeed = baseStats.runSpeed ?? PLAYER_CONFIG.RUN_SPEED ?? 8;

    this.baseDamage = baseStats.damage ?? PLAYER_CONFIG.ATTACK_DAMAGE ?? 10;
    this.baseAttackRange =
      baseStats.attackRange ?? PLAYER_CONFIG.ATTACK_RANGE ?? 2.0;
    this.basePerceptionRange = baseStats.perceptionRange ?? 1.0;
    this.attackCooldown = baseStats.attackCooldown ?? 2.0;

    this.baseMaxHealth = baseStats.health ?? PLAYER_CONFIG.HEALTH ?? 100;
    this.baseDamageReduction = baseStats.damageReduction ?? 0;

    this.baseColdResistance = baseStats.coldResistance ?? 0;

    this.entityRef = entityRef;
    this.isPlayer = isPlayer;

    // Initialize Leveling & Skill Points for Player
    if (this.isPlayer) {
      this.level = baseStats.initialLevel || 1;
      this.currentXP = baseStats.initialXP || 0;
      // Ensure skill points are initialized, potentially from saved state later
      this.availableSkillPoints = baseStats.initialSkillPoints || 0; // Default to 0 if not provided
      this.xpToNextLevel = this.calculateXpToNextLevel(this.level);
      console.log(
        `[StatsComponent Player Init] Lvl: ${this.level}, XP: ${this.currentXP}/${this.xpToNextLevel}, Skill Points: ${this.availableSkillPoints}` // Log skill points
      );
    } else {
      // ... (defaults for non-players) ...
      this.level = 1;
      this.currentXP = 0;
      this.xpToNextLevel = Infinity;
      this.availableSkillPoints = 0;
    }

    this.activeModifiers = [];

    this.equipmentBonuses = new Map(); // Initialize map
    this.activeTimedModifiers = []; // Initialize array

    this.recalculateCurrentStats(); // Initial calculation of all 'current' stats
  }

  /** Calculates XP needed to reach the *next* level */
  calculateXpToNextLevel(currentLevel) {
    if (currentLevel >= MAX_LEVEL) {
      return Infinity;
    }
    return XP_TO_LEVEL_UP[currentLevel] || Infinity;
  }

  /** Adds XP and checks for level up (only if isPlayer) */
  addXP(amount) {
    if (!this.isPlayer || this.level >= MAX_LEVEL || amount <= 0) {
      if (!this.isPlayer)
        console.warn(
          "[StatsComponent.addXP] Ignored XP gain for non-player component."
        );
      return;
    }

    this.currentXP += amount;
    console.log(
      `[StatsComponent.addXP] Added ${amount} XP. Total XP: ${this.currentXP}/${this.xpToNextLevel}`
    );

    // Emit XP Gained event immediately for UI update
    eventBus.emit("xpGained", {
      currentXP: this.currentXP,
      xpToNextLevel: this.xpToNextLevel,
      level: this.level,
    });

    // Check for level ups
    while (this.level < MAX_LEVEL && this.currentXP >= this.xpToNextLevel) {
      const remainingXP = this.currentXP - this.xpToNextLevel;
      this.levelUp(); // Level up handles stats, health update, and events
      this.currentXP = remainingXP;

      // Emit XP Gained event again AFTER level up with new threshold/zeroed currentXP
      eventBus.emit("xpGained", {
        currentXP: this.currentXP,
        xpToNextLevel: this.xpToNextLevel,
        level: this.level,
      });
    }

    // Clamp XP at max level
    if (this.level >= MAX_LEVEL) {
      this.currentXP = this.xpToNextLevel; // Set to exact threshold for max level
    }
  }

  /** Handles the level up process */
  levelUp() {
    if (!this.isPlayer || this.level >= MAX_LEVEL) return;

    this.level++;
    const oldXpRequirement = this.xpToNextLevel;
    this.xpToNextLevel = this.calculateXpToNextLevel(this.level);
    this.availableSkillPoints += 2; // <<< Grant skill point

    console.log(
      `%cLEVEL UP! Reached Level ${this.level}! (+1 Skill Point)`,
      "color: yellow; font-size: 1.2em; font-weight: bold;"
    );

    // --- Apply Level Up Bonuses ---
    const healthIncrease = 2; // base health increase
    // const damageIncrease = 1;
    // const speedIncrease = 0.05;

    this.baseMaxHealth += healthIncrease;
    // this.baseDamage += damageIncrease;
    // this.baseSpeed += speedIncrease;
    // this.baseRunSpeed += speedIncrease;

    // Recalculate ALL current stats to include the new base values
    this.recalculateCurrentStats();

    // --- Update Health Component ---
    const healthComp = this.entityRef?.userData?.health;
    if (healthComp) {
      // Update max health in health component
      healthComp.updateMaxHealth(this.currentMaxHealth); // Use NEW derived max health
      // Heal the player fully (or by the increased amount)
      healthComp.heal(this.currentMaxHealth); // Full heal
      // healthComp.heal(healthIncrease); // Heal by increase amount
    }

    // Emit level up event
    eventBus.emit("playerLeveledUp", {
      newLevel: this.level,
      xpToNextLevel: this.xpToNextLevel,
      availableSkillPoints: this.availableSkillPoints, // <<< Send skill points
      bonuses: {
        health: `+${healthIncrease} Base Max Health`,
        // damage: `+${damageIncrease} Base Damage`,
        // speed: `+${speedIncrease.toFixed(2)} Base Speed`,
      },
    });

    // Optionally emit statsChanged if other UI elements need generic update
    eventBus.emit("statsChanged", { component: this });
  }

  /**
   * Applies or updates a bonus from a specific source (like a skill rank).
   * @param {string} sourceId - Unique ID for the bonus source (e.g., "skill_toughness_rank_1").
   * @param {string} stat - The stat key (lowercase).
   * @param {number} value - The bonus value.
   * @param {'additive' | 'multiplicative'} type - The type of bonus.
   */
  applyStatBonus(sourceId, stat, value, type) {
    if (!sourceId || !stat || value === undefined || value === null) {
      console.warn("applyStatBonus: Invalid parameters", {
        sourceId,
        stat,
        value,
        type,
      });
      return;
    }
    // This map can store bonuses from equipment, skills, temporary buffs etc.
    // We are storing it on the StatComponent's equipmentBonuses map for simplicity now,
    // but you could create a separate `skillBonuses` map if preferred.
    console.log(
      `Applying bonus [${sourceId}]: ${stat} ${
        type === "multiplicative" ? "*" : "+"
      } ${value}`
    );
    this.equipmentBonuses.set(sourceId, {
      stat: stat.toLowerCase(),
      value,
      type,
    });
    this.recalculateCurrentStats(); // Recalculate after applying
  }

  /**
   * Removes a bonus associated with a specific source ID.
   * @param {string} sourceId - The unique ID of the bonus source to remove.
   */
  removeStatBonus(sourceId) {
    if (this.equipmentBonuses.has(sourceId)) {
      console.log(`Removing bonus [${sourceId}]`);
      this.equipmentBonuses.delete(sourceId);
      this.recalculateCurrentStats(); // Recalculate after removing
      return true;
    }
    return false;
  }

  /** Applies a temporary modifier */
  applyModifier(statKey, value, duration, id = null, type = "additive") {
    // Add optional ID
    const modifierId =
      id ||
      `mod_${statKey}_${Date.now()}_${Math.random().toString(16).slice(2)}`; // Generate unique ID if none provided
    console.log(
      `Applying modifier [${modifierId}]: ${statKey}, Value: ${value}, Duration: ${duration}s`
    );

    // Overwrite existing modifier with the same ID
    const existingIndex = this.activeModifiers.findIndex(
      (mod) => mod.id === modifierId
    );
    if (existingIndex !== -1) {
      console.warn(
        `Modifier with ID ${modifierId} already exists. Overwriting.`
      );
      this.activeModifiers.splice(existingIndex, 1);
    }

    const newModifier = {
      id: modifierId,
      stat: statKey.toLowerCase(),
      value: value,
      type: type, // <<< Store the type
      remainingDuration: duration,
    };
    this.activeModifiers.push(newModifier);
    this.recalculateCurrentStats();
    return newModifier; // Return the applied modifier object
  }

  removeModifierById(modifierId) {
    if (!modifierId) return false;
    const initialLength = this.activeModifiers.length;
    this.activeModifiers = this.activeModifiers.filter(
      (mod) => mod.id !== modifierId
    );
    const removed = this.activeModifiers.length < initialLength;
    if (removed) {
      console.log(`Removed modifier with ID: ${modifierId}`);
      this.recalculateCurrentStats(); // Recalculate after removing
    }
    return removed;
  }

  /**
   * Applies a persistent bonus from an equipped item.
   * @param {string} stat - The stat key (e.g., 'damage', 'maxHealth').
   * @param {number} value - The bonus value.
   * @param {string} uniqueBonusId - A unique identifier for this specific bonus (e.g., 'sword_weapon').
   */
  applyEquipmentBonus(stat, value, uniqueBonusId, type = "additive") {
    if (this.equipmentBonuses.has(uniqueBonusId)) {
      console.warn(`Equipment bonus ${uniqueBonusId} already applied.`);
      return;
    }
    console.log(
      `Applying equipment bonus [${uniqueBonusId}]: ${stat} +${value} (${type})`
    );
    this.equipmentBonuses.set(uniqueBonusId, {
      stat: stat.toLowerCase(),
      value,
      type,
    });
    this.recalculateCurrentStats();
  }

  /**
   * Removes a persistent bonus from an unequipped item.
   * @param {string} stat - The stat key (e.g., 'damage', 'maxHealth'). // Optional, could derive from ID
   * @param {number} value - The bonus value. // Optional, could derive from ID
   * @param {string} uniqueBonusId - The unique identifier used when applying.
   */
  removeEquipmentBonus(stat, value, uniqueBonusId, type = "additive") {
    // stat/value args might be removed if not needed
    if (this.equipmentBonuses.has(uniqueBonusId)) {
      console.log(
        `Removing equipment bonus [${uniqueBonusId}]: ${stat} +${value} (${type})`
      );
      this.equipmentBonuses.delete(uniqueBonusId);
      this.recalculateCurrentStats(); // Recalculate after removing
    } else {
      console.warn(
        `Attempted to remove non-existent equipment bonus: ${uniqueBonusId}`
      );
    }
  }

  /** Recalculates current stats based on base stats and active modifiers */
  recalculateCurrentStats() {
    // Reset current stats to base stats
    this.currentSpeed = this.baseSpeed;
    this.currentRunSpeed = this.baseRunSpeed;
    this.currentDamage = this.baseDamage;
    this.currentAttackRange = this.baseAttackRange;
    this.perceptionRange = this.basePerceptionRange;
    this.currentMaxHealth = this.baseMaxHealth; // <<< Start with base max health
    this.currentDamageReduction = this.baseDamageReduction; // <<< Reset to base
    this.currentColdResistance = this.baseColdResistance; // <<< Reset to base

    // --- ADD Multiplier Initialization ---
    this.currentSpeedMultiplier = this.speedMultiplier = 1.0;
    this.currentDamageMultiplier = this.speedMultiplier = 1.0;

    console.log(
      "Equipment Bonuses Map Keys:",
      Array.from(this.equipmentBonuses.values()).map((b) => b.stat)
    );

    // // 2. Apply EQUIPMENT bonuses (persistent, additive)
    // for (const [id, bonus] of this.equipmentBonuses.entries()) {
    //   // <<< Iterate equipment bonuses
    //   switch (bonus.stat) {
    //     case "damage":
    //       this.currentDamage += bonus.value;
    //       console.log(this.currentDamage);
    //       break;
    //     case "speed":
    //       this.currentSpeed += bonus.value;
    //       this.currentRunSpeed += bonus.value;
    //       break;
    //     case "maxhealth":
    //       this.currentMaxHealth += bonus.value;
    //       break;
    //     case "attackrange":
    //       this.currentAttackRange += bonus.value;
    //       break;
    //     case "damagereduction":
    //       this.currentDamageReduction += bonus.value;
    //       break;
    //     case "coldresistance":
    //       this.currentColdResistance += bonus.value;
    //       console.log(this.currentColdResistance);
    //       break;
    //   }
    // }

    // // Apply active modifiers, (additive)
    // for (const mod of this.activeModifiers) {
    //   switch (mod.stat) {
    //     case "damage":
    //       this.currentDamage += mod.value;
    //       break;
    //     case "speed":
    //       this.currentSpeed += mod.value;
    //       this.currentRunSpeed += mod.value; // Assume buffs affect both
    //       break;
    //     case "maxhealth": // case for maxHealth modifiers
    //       this.currentMaxHealth += mod.value;
    //       break;
    //     case "damagereduction":
    //       this.currentDamageReduction += mod.value;
    //       break;
    //     case "coldresistance":
    //       this.currentColdResistance += mod.value;
    //       console.log(
    //         "additive cold resistance modifier applied from ability."
    //       );
    //       break;
    //   }
    // }

    // // --- Apply Multiplicative Bonuses Second ---
    // let speedMultiplier = 1.0;
    // let damageMultiplier = 1.0;
    // // Add multipliers for other stats if needed

    // // Equipment Bonuses (Multiplicative Pass)
    // for (const [id, bonus] of this.equipmentBonuses.entries()) {
    //   if (bonus.type === "multiplicative") {
    //     switch (bonus.stat) {
    //       case "speed":
    //         speedMultiplier *= bonus.value;
    //         break;
    //       case "damage":
    //         damageMultiplier *= bonus.value;
    //         break;
    //       // Add cases for other multiplicative stats
    //     }
    //   }
    // }

    // // Active Modifiers (Multiplicative Pass)
    // for (const mod of this.activeModifiers) {
    //   if (mod.type === "multiplicative") {
    //     switch (mod.stat) {
    //       case "speed":
    //         speedMultiplier *= mod.value;
    //         break;
    //       case "damage":
    //         damageMultiplier *= mod.value;
    //         break;
    //       // Add cases for other multiplicative stats
    //     }
    //   }
    // }

    // // Apply multipliers
    // this.currentSpeed *= speedMultiplier;
    // this.currentRunSpeed *= speedMultiplier; // Apply same multiplier to run speed
    // this.currentDamage *= damageMultiplier;

    // // Ensure stats don't go below reasonable minimums
    // this.currentDamage = Math.max(1, this.currentDamage);
    // this.currentSpeed = Math.max(0.1, this.currentSpeed);
    // this.currentRunSpeed = Math.max(0.1, this.currentRunSpeed);
    // this.currentMaxHealth = Math.max(1, this.currentMaxHealth); // Ensure min maxHealth is 1
    // this.currentAttackRange = Math.max(0.5, this.currentAttackRange);
    // // clamp to a hard cap of 0.9 (90% reduction)
    // this.currentDamageReduction = Math.max(
    //   0,
    //   Math.min(0.9, this.currentDamageReduction)
    // );
    // // immune to cold dot damage?
    // this.currentColdResistance = Math.max(
    //   0,
    //   Math.min(1.0, this.currentColdResistance)
    // ); // <<< CLAMP Cold Resistance
    // this.perceptionRange = this.basePerceptionRange;

    // // --- Update Health Component if Max Health Changed ---
    // // This ensures the HealthComponent's internal max value (used for clamping) is updated
    // // if a buff changes max health *between* level ups.
    // const healthComp = this.entityRef?.userData?.health;
    // if (healthComp && healthComp.maxHealth !== this.currentMaxHealth) {
    //   healthComp.updateMaxHealth(this.currentMaxHealth);
    // }

    // --- Apply Additive Bonuses First ---
    let additiveBonuses = {}; // Temporary object to sum additive bonuses

    // Collect all additive bonuses (Equipment + Timed Modifiers)
    for (const [id, bonus] of this.equipmentBonuses.entries()) {
      if (bonus.type === "additive" || bonus.type === undefined) {
        additiveBonuses[bonus.stat] =
          (additiveBonuses[bonus.stat] || 0) + bonus.value;
      }
    }
    for (const mod of this.activeModifiers) {
      if (mod.type === "additive" || mod.type === undefined) {
        additiveBonuses[mod.stat] =
          (additiveBonuses[mod.stat] || 0) + mod.value;
      }
    }

    // Apply summed additive bonuses
    this.currentDamage += additiveBonuses["damage"] || 0;
    this.currentSpeed += additiveBonuses["speed"] || 0;
    this.currentRunSpeed += additiveBonuses["speed"] || 0; // Additive speed affects both
    this.currentMaxHealth += additiveBonuses["maxhealth"] || 0;
    this.currentAttackRange += additiveBonuses["attackrange"] || 0;
    this.currentDamageReduction += additiveBonuses["damagereduction"] || 0;
    this.currentColdResistance += additiveBonuses["coldresistance"] || 0;
    // Add others...

    // --- Apply Multiplicative Bonuses Second ---
    let speedMultiplier = 1.0;
    let damageMultiplier = 1.0;

    // Collect all multiplicative bonuses
    for (const [id, bonus] of this.equipmentBonuses.entries()) {
      if (bonus.type === "multiplicative") {
        switch (bonus.stat) {
          case "speed":
            speedMultiplier *= bonus.value;
            break;
          case "damage":
            damageMultiplier *= bonus.value;
            break;
          // Add cases for other multiplicative stats
        }
      }
    }
    for (const mod of this.activeModifiers) {
      if (mod.type === "multiplicative") {
        switch (mod.stat) {
          case "speed":
            speedMultiplier *= mod.value;
            break;
          case "damage":
            damageMultiplier *= mod.value;
            break;
          // Add cases for other multiplicative stats
        }
      }
    }

    // Apply multipliers AFTER additive bonuses have been applied to base stats
    this.currentSpeed *= speedMultiplier;
    this.currentRunSpeed *= speedMultiplier;
    this.currentDamage *= damageMultiplier;

    // Ensure stats don't go below reasonable minimums / clamp values
    this.currentDamage = Math.max(1, this.currentDamage);
    this.currentSpeed = Math.max(0.1, this.currentSpeed);
    this.currentRunSpeed = Math.max(0.1, this.currentRunSpeed);
    this.currentMaxHealth = Math.max(1, this.currentMaxHealth);
    this.currentAttackRange = Math.max(0.5, this.currentAttackRange);
    this.currentDamageReduction = Math.max(
      0,
      Math.min(0.9, this.currentDamageReduction)
    ); // 0% to 90%
    this.currentColdResistance = Math.max(
      0,
      Math.min(1.0, this.currentColdResistance)
    ); // 0% to 100%

    // --- Update Health Component if Max Health Changed ---
    const healthComp = this.entityRef?.userData?.health;
    if (healthComp && healthComp.maxHealth !== this.currentMaxHealth) {
      healthComp.updateMaxHealth(this.currentMaxHealth);
    }

    // Optional: Emit a generic 'statsChanged' event if other systems need notification
    // eventBus.emit('statsChanged', { component: this });
    // console.log("[StatsComponent] Recalculated Stats:", { Dmg: this.currentDamage, Spd: this.currentSpeed, MaxHP: this.currentMaxHealth }); // Optional log
  }

  /** Updates modifier durations. Call every frame. */
  updateModifiers(delta) {
    let statsChanged = false;
    // Create a copy of the array to iterate over, allowing safe removal from the original
    const modifiersToProcess = [...this.activeModifiers];

    for (let i = modifiersToProcess.length - 1; i >= 0; i--) {
      const mod = modifiersToProcess[i];
      if (mod.remainingDuration !== Infinity) {
        mod.remainingDuration -= delta;
        if (mod.remainingDuration <= 0) {
          // Use removeModifierById which handles recalculation
          const removed = this.removeModifierById(mod.id);
          if (removed) {
            eventBus.emit("buffExpired", {
              entity: this.entityRef,
              stat: mod.stat,
              value: mod.value,
              id: mod.id,
            });
            // statsChanged = true; // No longer needed here, removeModifierById handles recalc
          }
        }
      }
    }
    // Recalculation happens inside removeModifierById, so no need for final check here
    // if (statsChanged) {
    //   this.recalculateCurrentStats();
    // }
  }

  // --- Getters for current stats ---
  getCurrentSpeed() {
    return this.currentSpeed;
  }
  getCurrentRunSpeed() {
    return this.currentRunSpeed;
  }
  getCurrentDamage() {
    return this.currentDamage;
  }
  getCurrentAttackRange() {
    return this.currentAttackRange;
  }
  getCurrentMaxHealth() {
    return this.currentMaxHealth;
  }
  getPerceptionRange() {
    return this.perceptionRange;
  }
  getAttackCooldown() {
    return this.attackCooldown;
  }
  getBaseMaxHealth() {
    return this.baseMaxHealth;
  }
}

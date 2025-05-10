// src/systems/AbilitySystem.js
import eventBus from "../core/EventBus.js";
import { getAbilityData } from "../config/AbilityConfig.js";
import { PLAYER_CONFIG } from "../config/PlayerConfig.js"; // For default ranges etc.
// Import components needed for effects
import { HealthComponent } from "../game/components/HealthComponent.js";
import { StatsComponent } from "../game/components/StatsComponent.js";
// Import systems needed for effects
import { PhysicsEngine } from "../physics/PhysicsEngine.js";
import { SceneManager } from "../world/SceneManager.js";
import { UIManager } from "../ui/UIManager.js";
import * as THREE from "three"; // For vector math, projectile creation etc.

export class AbilitySystem {
  /** @type {PhysicsEngine} */
  physicsEngine;
  /** @type {SceneManager} */
  sceneManager;
  /** @type {UIManager} */
  uiManager;
  /** @type {Array<object>} List of active effects needing updates (e.g., projectiles) */
  activeProjectiles = []; // Tracking projectiles

  constructor(physicsEngine, sceneManager, uiManager) {
    this.physicsEngine = physicsEngine;
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;

    // Listen for the event emitted by PlayerController
    eventBus.on("useAbility", this.handleUseAbility.bind(this));

    console.log(
      "AbilitySystem initialized and listening for 'useAbility' events."
    );
  }

  /** Handles the execution of an ability when the event is received */
  handleUseAbility(eventData) {
    const { caster, casterBody, abilityId } = eventData;
    const abilityData = getAbilityData(abilityId);

    if (!caster || !abilityData) {
      console.error(
        `AbilitySystem: Invalid caster or ability data for ID: ${abilityId}`
      );
      return;
    }

    console.log(
      `AbilitySystem: Executing ${abilityId} for caster ${
        caster.name || "unknown"
      }`
    );

    this.uiManager?.showChatBubble(`Used ${abilityData.name}!`); // Show bubble on ability use

    this.uiManager?.log(`Using ${abilityData.name}!`); // Give user feedback

    // --- Execute based on ability type ---
    switch (abilityData.type) {
      case "targeted_attack":
        this.executeTargetedAttack(caster, casterBody, abilityData);
        break;

      case "self_buff":
        this.executeSelfBuff(caster, casterBody, abilityData);
        break;
      default:
        console.warn(
          `AbilitySystem: Unknown ability type '${abilityData.type}' for ${abilityId}`
        );
    }
  }

  // --- Execution Methods ---

  executeTargetedAttack(caster, casterBody, abilityData) {
    const range = abilityData.range || PLAYER_CONFIG.ATTACK_RANGE;
    const forward = new THREE.Vector3();
    const rayStart = new THREE.Vector3();
    const rayEnd = new THREE.Vector3();

    caster.getWorldDirection(forward);
    caster.getWorldPosition(rayStart);
    rayStart.y += 1.0; // Origin height adjustment
    rayStart.addScaledVector(forward, 0.1); // Start slightly ahead
    rayEnd.copy(rayStart).addScaledVector(forward, range);

    // Update raycast call and result handling >>>
    const hitResult = this.physicsEngine.raycast(rayStart, rayEnd, casterBody);
    const hitBody = hitResult?.body; // Extract body

    if (hitBody?.userData) {
      // Check if hitBody and userData exist
      const targetHealthComp = hitBody.userData.healthComponent;
      const casterStatsComp = caster.userData.stats;
      const targetName =
        hitBody.userData.nodeName ||
        hitBody.userData.threeObject?.name ||
        "Target";

      // --- Add Debug Logs Here ---
      console.log("--- Ability Hit Debug ---");
      console.log("Target Body UserData:", hitBody.userData); // Log all data on the target
      console.log("Target Health Component:", targetHealthComp); // Check if it exists
      console.log("Caster Stats Component:", casterStatsComp); // Check if it exists
      if (casterStatsComp) {
        console.log("Caster Current Damage:", casterStatsComp.currentDamage); // Check the actual damage value
      }
      console.log("------------------------");

      if (targetHealthComp && casterStatsComp) {
        const baseDamage = casterStatsComp.currentDamage || 10;
        const damageMultiplier = abilityData.damageMultiplier || 1.0;
        const calculatedDamage = Math.round(baseDamage * damageMultiplier);

        console.log(
          `Ability ${abilityData.id} hitting ${targetName} for ${calculatedDamage} damage.`
        );
        this.uiManager?.log(
          `Hit ${targetName} with ${abilityData.name} for ${calculatedDamage}!`
        );
        targetHealthComp.takeDamage(calculatedDamage);
        // Handle death logic via events, not directly here
      } else {
        this.uiManager?.log(
          `${abilityData.name} hit ${targetName}, but it cannot take damage.`
        );
      }
    } else {
      this.uiManager?.log(`${abilityData.name} missed.`);
    }

    // IMPORTANT: Clean up the Ammo vectors from the raycast result
    if (hitResult) {
      Ammo.destroy(hitResult.point);
      Ammo.destroy(hitResult.normal);
    }
  }

  executeSelfBuff(caster, casterBody, abilityData) {
    const casterStatsComp = caster.userData.stats;

    if (!casterStatsComp) {
      console.error(
        `AbilitySystem: Caster missing StatsComponent for buff ${abilityData.id}`
      );
      return;
    }

    if (typeof casterStatsComp.applyModifier === "function") {
      const duration = abilityData.durationSeconds || 0;
      let applied = false;

      // Check specifically for speedBonus
      if (typeof abilityData.speedBonus === "number") {
        casterStatsComp.applyModifier(
          "speed",
          abilityData.speedBonus,
          duration
        );
        this.uiManager?.log(
          `Applied ${abilityData.name}! (+${abilityData.speedBonus} Speed)`
        );
        applied = true;
      }
      // Check for Damage Reduction Bonus >>>
      else if (typeof abilityData.damageReductionBonus === "number") {
        casterStatsComp.applyModifier(
          "damagereduction",
          abilityData.damageReductionBonus,
          duration
        ); // Use 'damagereduction' key
        const percent = Math.round(abilityData.damageReductionBonus * 100);
        this.uiManager?.log(
          `Applied ${abilityData.name}! (${percent}% Damage Reduction)`
        );
        applied = true;
        // Check for Cold Resistance Bonus >>>
      } else if (typeof abilityData.coldResistanceBonus === "number") {
        casterStatsComp.applyModifier(
          "coldresistance",
          abilityData.coldResistanceBonus,
          duration
        );
        this.uiManager?.log(
          `Applied ${abilityData.name}! (+${abilityData.coldResistanceBonus} Cold Resistance)`
        );
        applied = true;
      }

      if (!applied) {
        console.warn(
          `No recognized bonus value found for buff ${abilityData.id}`
        );
      }
      // TODO: Add visual effect to caster
    } else {
      console.warn(
        `StatsComponent does not have applyModifier method. Cannot apply buff ${abilityData.id}.`
      );
      this.uiManager?.log(
        `Used ${abilityData.name} (Effect needs StatsComponent update).`
      );
    }
  }

  /** Update active effects like projectiles */
  update(delta) {
    // --- Update Projectiles ---
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const body = this.activeProjectiles[i];
      const userData = body.userData;

      userData.lifeTime -= delta;

      // Check for collision (needs implementation in PhysicsEngine or here)
      // const hitResult = this.physicsEngine.checkProjectileCollision(body); // Hypothetical collision check
      const hitResult = null; // Placeholder

      if (userData.lifeTime <= 0 || hitResult) {
        if (hitResult) {
          // Apply damage/effect to hitResult.targetBody
          const targetHealth = hitResult.targetBody?.userData?.healthComponent;
          if (targetHealth && hitResult.targetBody !== userData.casterBody) {
            targetHealth.takeDamage(userData.abilityData.damage || 0);
            console.log(`Projectile ${userData.abilityData.id} hit target.`);
            this.uiManager?.log(`Projectile hit!`);
          }
        }
        // Remove projectile
        this.sceneManager.remove(userData.threeObject);
        this.physicsEngine.removeBody(body);
        if (userData.threeObject?.geometry)
          userData.threeObject.geometry.dispose();
        if (userData.threeObject?.material)
          userData.threeObject.material.dispose();
        this.activeProjectiles.splice(i, 1);
        continue; // Skip movement update for removed projectile
      }

      // --- Move Kinematic Projectile ---
      // This requires PhysicsEngine to handle kinematic bodies correctly
      // or we manually set the transform each frame. Manual transform is simpler here:
      const transform = body.getWorldTransform(); // Reuse existing method? Or body.getMotionState().getWorldTransform(this.physicsEngine.tempTransform)
      const origin = transform.getOrigin();
      const moveVec = userData.direction
        .clone()
        .multiplyScalar(userData.speed * delta);
      const newPos = new THREE.Vector3(
        origin.x() + moveVec.x,
        origin.y() + moveVec.y,
        origin.z() + moveVec.z
      );

      // Update physics body transform directly (requires body to be kinematic and active)
      this.physicsEngine.setBodyTransform(body, newPos, {
        x: 0,
        y: 0,
        z: 0,
        w: 1,
      }); // Keep rotation identity for sphere
      // Sync visual (should happen via PhysicsEngine update if linked correctly, or manual sync here)
      // userData.threeObject.position.copy(newPos);
    }
  }
} // End AbilitySystem class

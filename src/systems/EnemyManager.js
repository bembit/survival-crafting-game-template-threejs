// src/systems/EnemyManager.js
import { getEnemyData } from "../config/EnemiesConfig.js";
import { HealthComponent } from "../game/components/HealthComponent.js";
import { StatsComponent } from "../game/components/StatsComponent.js";
import { LootComponent } from "../game/components/LootComponent.js"; // For potential loot table parsing
import { InteractableComponent } from "../game/components/InteractableComponent.js";
import { AIComponent, AI_STATES } from "../game/components/AIComponent.js";
import { EnemyAnimationFSM } from "../animation/EnemyAnimationFSM.js";
import * as THREE from "three";
import eventBus from "../core/EventBus.js";

export class EnemyManager {
  activeEnemies = new Map(); // Map enemy entity ID to enemy object/data
  interactionSystem = null;
  gameInstance = null; // To access player easily

  constructor(
    resourceManager,
    physicsEngine,
    sceneManager,
    animationSystem,
    aiSystem,
    uiManager,
    interactionSystem,
    gameInstance // gameInstance parameter
  ) {
    this.resourceManager = resourceManager;
    this.physicsEngine = physicsEngine;
    this.sceneManager = sceneManager;
    this.animationSystem = animationSystem;
    this.aiSystem = aiSystem; // Need AISystem reference
    this.uiManager = uiManager;
    this.interactionSystem = interactionSystem;
    this.gameInstance = gameInstance;

    try {
      // Ensure the binding is correct
      const boundHandler = this.handleEnemyDied.bind(this);
      eventBus.on("enemyDied", boundHandler);
      console.log(
        "%cEnemyManager: Successfully subscribed to 'enemyDied' event.",
        "color: green;"
      );
    } catch (e) {
      console.error(
        "EnemyManager: FAILED to subscribe to 'enemyDied' event:",
        e
      );
    }
    console.log("EnemyManager initialized.");
  }

  /** Spawns an enemy based on ID and position */
  async spawnEnemy(enemyId, desiredPosition) {
    console.log(`Attempting to spawn enemy: ${enemyId} at`, desiredPosition);
    const enemyData = getEnemyData(enemyId);
    if (!enemyData) {
      console.error(`Failed to find enemy data for ID: ${enemyId}`);
      return null;
    }

    try {
      // --- Determine Actual Ground Position ---
      const groundY = this.physicsEngine.getHeightAt(
        desiredPosition.x,
        desiredPosition.z
      );
      const spawnGroundY = groundY ?? desiredPosition.y ?? 0;

      // Generate a unique ID for this specific instance (e.g., using UUID library or simple counter)
      const instanceId = `${enemyId}_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

      // console.log(`Calculated spawn ground Y for ${enemyId}: ${spawnGroundY.toFixed(2)}`);

      // 1. Load Model
      const { gltf, model } = await this.resourceManager.loadModel(
        enemyData.modelConfig
      );
      // ... (normalization if needed) ...

      // --- Calculate PHYSICS Body Center Y ---
      const physicsHalfHeight = enemyData.physicsConfig.hy; // <<< GET hy FROM CONFIG
      if (typeof physicsHalfHeight !== "number" || physicsHalfHeight <= 0) {
        console.warn(
          `Invalid hy (${physicsHalfHeight}) configured for ${enemyId}. Using fallback 0.5.`
        );
        const physicsHalfHeight = 0.5; // Use a sensible fallback
      }
      const physicsCenterY = spawnGroundY + physicsHalfHeight; // Center = Ground + Half Height

      // --- Set VISUAL Model Position ---
      // Position the model's origin (assuming feet) ON the ground
      model.position.set(desiredPosition.x, spawnGroundY, desiredPosition.z);
      model.name = enemyData.name;

      // 2. Create Physics Body Options (Using Config Dimensions)
      const bodyOptions = {
        ...enemyData.physicsConfig, // Use hx, hy, hz etc. from config
        position: {
          // Set Physics Body Center Position
          x: desiredPosition.x,
          y: physicsCenterY, // <<< Use calculated center Y
          z: desiredPosition.z,
        },
        threeObject: model,
        nodeId: enemyData.id,
        nodeName: enemyData.name,
        interactableType: "enemy", // THIS (or pass isEnemy: true)
        baseStats: enemyData.stats, // Pass stats for StatsComponent creation inside createBody
        initialHealth: enemyData.stats.health, // Pass health for HealthComponent creation
        instanceId: instanceId, // Pass instanceId for HealthComponent death event
      };

      // 3. Create Physics Body
      const physicsBody = this.physicsEngine.createBody(bodyOptions);
      if (physicsBody) {
        model.userData.physicsBody = physicsBody; // Existing line

        // --- Add Logs ---
        const finalModelY = model.position.y;
        const bodyTransform = physicsBody.getWorldTransform();
        const bodyOrigin = bodyTransform.getOrigin();
        const finalBodyCenterY = bodyOrigin.y();

        console.log(`--- Spawn Positioning Log for ${enemyData.name} ---`);
        console.log(`Desired Ground Y: ${spawnGroundY.toFixed(3)}`);
        console.log(
          `Physics Half-Height (hy): ${physicsHalfHeight.toFixed(3)}`
        );
        console.log(
          `Calculated Physics Center Y: ${physicsCenterY.toFixed(3)}`
        );
        console.log(`Final Model Position Y: ${finalModelY.toFixed(3)}`);
        console.log(
          `Actual Physics Body Center Y: ${finalBodyCenterY.toFixed(3)}`
        );
        console.log(`------------------------------------------`);
      } else {
        throw new Error("Failed to create physics body for enemy."); // Move throw here
      }
      model.userData.physicsBody = physicsBody;

      // --- Adjust Physics Body position slightly if needed ---
      // Sometimes, due to precision, starting exactly on ground causes issues.
      // You might nudge the physics body up slightly *after* creation if needed:
      // const nudge = 0.01;
      // const transform = physicsBody.getWorldTransform();
      // const origin = transform.getOrigin();
      // origin.setY(origin.y() + nudge);
      // physicsBody.setWorldTransform(transform);
      // physicsBody.activate(true);

      // 3. Attach Components (using data from config)

      // Removed to be common with physics body components
      // model.userData.healthComponent = new HealthComponent(
      //   enemyData.stats.health || 100
      // );
      // model.userData.statsComponent = new StatsComponent(enemyData.stats); // Pass base stats

      model.userData.aiComponent = new AIComponent(); // Basic AI state
      model.userData.interactableComponent = new InteractableComponent(
        "enemy",
        { hostile: true }
      ); // Mark as enemy interactable
      // Add LootComponent later based on lootTable processing if needed on death
      // Store config data directly if needed by other systems
      model.userData.enemyConfig = enemyData;

      // Link components to physics body userData if needed by physics/interaction checks
      physicsBody.userData.healthComponent = model.userData.healthComponent;
      physicsBody.userData.statsComponent = model.userData.statsComponent;
      physicsBody.userData.aiComponent = model.userData.aiComponent;
      physicsBody.userData.interactableComponent =
        model.userData.interactableComponent;
      physicsBody.userData.enemyConfig = enemyData; // Link config data too

      // 4. Setup Animation FSM
      let enemyFSM = null;
      if (
        gltf.animations &&
        gltf.animations.length > 0 &&
        this.animationSystem
      ) {
        const mixer = new THREE.AnimationMixer(model);
        const actions = {};
        gltf.animations.forEach((clip) => {
          actions[clip.name] = mixer.clipAction(clip);
        });
        enemyFSM = new EnemyAnimationFSM(mixer, actions, enemyData.animations); // Pass map
        this.animationSystem.registerMixer(mixer);
        model.userData.animationFSM = enemyFSM; // Store FSM reference
      }

      // 5. Add to Scene & Managers
      this.sceneManager.add(model);

      model.userData.instanceId = instanceId;
      physicsBody.userData.instanceId = instanceId;

      this.activeEnemies.set(instanceId, { model, physicsBody, enemyId }); // Track active enemy
      this.aiSystem.registerEnemy(instanceId, model, physicsBody); // Register with AI system

      console.log(`Successfully spawned ${enemyData.name} (${instanceId})`);
      return instanceId;
    } catch (error) {
      console.error(`Error spawning enemy ${enemyId}:`, error);
      return null;
    }
  }

  /** Handles cleanup when an enemy's death is detected via the 'enemyDied' event */
  handleEnemyDied(eventData) {
    const instanceId = eventData?.instanceId; // Safely access instanceId
    if (!instanceId) {
      console.warn(
        "EnemyManager: Received enemyDied event without instanceId."
      );
      return;
    }
    // Add log marker for the start of the handler
    console.log(`[${instanceId}] handleEnemyDied function START.`);
    console.log(`EnemyManager handling death sequence for: ${instanceId}`);
    const enemyInfo = this.activeEnemies.get(instanceId);

    if (enemyInfo) {
      const { model, physicsBody, enemyId } = enemyInfo;
      const enemyData = getEnemyData(enemyId); // Get config data if needed for loot etc.

      // --- Grant XP to Player
      if (
        enemyData?.xpValue > 0 &&
        this.gameInstance?.playerController?.player
      ) {
        const playerStats =
          this.gameInstance.playerController.player.userData.stats;
        if (playerStats && typeof playerStats.addXP === "function") {
          console.log(
            `[${instanceId}] Granting ${enemyData.xpValue} XP to player.`
          );
          playerStats.addXP(enemyData.xpValue);
          this.uiManager?.log(
            `Defeated ${enemyData.name}! (+${enemyData.xpValue} XP)`,
            "green"
          );
        } else {
          console.warn(
            `[${instanceId}] Could not grant XP: Player StatsComponent or addXP method not found.`
          );
        }
      } else if (enemyData?.xpValue <= 0) {
        console.log(`[${instanceId}] Enemy has no XP value.`);
      } else {
        console.warn(
          `[${instanceId}] Could not grant XP: Game instance or player controller/object missing.`
        );
      }
      // --- END Grant XP

      // 1. Ensure AI State is DEAD and Animation is Triggered
      //    (AISystem should handle setting the state, which triggers the FSM)
      //    We assume the FSM has been updated by AISystem to play the death animation.
      // 1. Ensure AI State is DEAD (AISystem should handle this, but double-check/warn)
      const ai = model?.userData?.aiComponent;
      if (ai && ai.currentState !== AI_STATES.DEAD) {
        console.warn(
          `[${instanceId}] AI state was ${ai.currentState} during handleEnemyDied. AISystem should have set it to DEAD.`
        );
        // Optionally force it: ai.setState(AI_STATES.DEAD);
      } else if (!ai) {
        console.warn(
          `[${instanceId}] AIComponent missing during handleEnemyDied.`
        );
      }

      if (physicsBody) {
        physicsBody.userData = physicsBody.userData || {}; // Ensure userData exists
        physicsBody.userData.isDead = true; // THIS FLAG HERE INSTEAD OF ANIMATION IN PHYSICS ENGINE
      }
      // // 2. Optional: Disable Physics Collision Response for the Dead Body
      // //    Prevents the corpse from being pushed around weirdly during the delay.
      // if (physicsBody && !physicsBody.isStaticObject()) {
      //   try {
      //     const flags = physicsBody.getCollisionFlags();
      //     physicsBody.setCollisionFlags(flags | 4); // Add CF_NO_CONTACT_RESPONSE
      //     // Zero out velocities again for safety
      //     const physicsTempVec = this.physicsEngine.tempVec3;
      //     if (physicsTempVec) {
      //       physicsTempVec.setValue(0, 0, 0);
      //       physicsBody.setLinearVelocity(physicsTempVec);
      //       physicsBody.setAngularVelocity(physicsTempVec);
      //     }
      //     physicsBody.activate(true);
      //     console.log(
      //       `[${instanceId}] Disabled physics collisions for dead body.`
      //     );
      //   } catch (e) {
      //     console.error(
      //       `[${instanceId}] Error modifying physics body flags on death:`,
      //       e
      //     );
      //   }
      // }

      // // 2. Make Physics Body Kinematic on Death
      // if (physicsBody && !physicsBody.isStaticObject()) {
      //   try {
      //     const flags = physicsBody.getCollisionFlags();
      //     // Add the KINEMATIC object flag (value 2)
      //     // Keep NO_CONTACT_RESPONSE (4) as well? Optional, kinematic often sufficient.
      //     // Let's just set Kinematic for now.
      //     physicsBody.setCollisionFlags(flags | 2); // flag '2' is Ammo.CollisionFlags.CF_KINEMATIC_OBJECT

      //     // Kinematic objects need specific activation state
      //     physicsBody.setActivationState(4); // Set to DISABLE_DEACTIVATION

      //     // Zero out velocities just in case
      //     const physicsTempVec = this.physicsEngine.tempVec3;
      //     if (physicsTempVec) {
      //       physicsTempVec.setValue(0, 0, 0);
      //       physicsBody.setLinearVelocity(physicsTempVec);
      //       physicsBody.setAngularVelocity(physicsTempVec);
      //     }
      //     console.log(`[${instanceId}] Made physics body KINEMATIC on death.`);
      //   } catch (e) {
      //     console.error(
      //       `[${instanceId}] Error setting physics body kinematic on death:`,
      //       e
      //     );
      //   }
      // }

      // --- ***** Store Death Position ***** ---
      // Get position just before physics body is removed (or from model if body already gone)
      let deathPosition = new THREE.Vector3();
      if (physicsBody) {
        const transform = physicsBody.getWorldTransform();
        const origin = transform.getOrigin();
        deathPosition.set(origin.x(), origin.y(), origin.z());
      } else if (model) {
        model.getWorldPosition(deathPosition); // Fallback to model position
      }
      console.log(`[${instanceId}] Stored death position:`, deathPosition);
      // --- ***** END Store Death Position ***** ---

      // --- ***** IMMEDIATE Physics Body Removal ***** ---
      try {
        if (physicsBody && this.physicsEngine) {
          // Remove the physics body right away
          this.physicsEngine.removeBody(physicsBody);
          console.log(`[${instanceId}] Physics body removed immediately.`);
          // Nullify reference in enemyInfo so timeout doesn't try again
          enemyInfo.physicsBody = null;
        } else if (!physicsBody) {
          console.warn(
            `[${instanceId}] Physics body already missing before immediate removal.`
          );
        } else {
          console.error(
            `[${instanceId}] PhysicsEngine reference missing, cannot remove body.`
          );
        }
      } catch (e) {
        console.error(
          `[${instanceId}] Error during immediate physics body removal:`,
          e
        );
      }
      // --- ***** END IMMEDIATE Removal ***** ---

      // --- ***** Process Loot Drop ***** ---
      if (
        enemyData?.lootTable &&
        enemyData.lootTable.length > 0 &&
        this.physicsEngine
      ) {
        console.log(`[${instanceId}] Processing loot table...`);
        const baseSpawnY =
          this.physicsEngine.getHeightAt(deathPosition.x, deathPosition.z) ??
          deathPosition.y;
        const spawnOffset = 0.3; // How far apart items spawn

        enemyData.lootTable.forEach(async (itemConfig, index) => {
          // Check drop chance
          if (Math.random() < itemConfig.chance) {
            // Determine quantity (handle single value or range)
            let quantityToDrop = 1;
            if (Array.isArray(itemConfig.quantity)) {
              quantityToDrop =
                Math.floor(
                  Math.random() *
                    (itemConfig.quantity[1] - itemConfig.quantity[0] + 1)
                ) + itemConfig.quantity[0];
            } else {
              quantityToDrop = itemConfig.quantity || 1;
            }

            console.log(
              `[${instanceId}] Dropping ${quantityToDrop}x ${itemConfig.itemId}`
            );

            for (let i = 0; i < quantityToDrop; i++) {
              // Slightly randomize spawn position around death point
              const spawnX =
                deathPosition.x + (Math.random() - 0.5) * spawnOffset * 2;
              const spawnZ =
                deathPosition.z + (Math.random() - 0.5) * spawnOffset * 2;
              // Use terrain height at the randomized spot, fallback to corpse height
              const spawnY =
                (this.physicsEngine.getHeightAt(spawnX, spawnZ) ?? baseSpawnY) +
                0.35; // Spawn slightly above ground

              // Define loot model path (use path from config or default)
              const modelPath = itemConfig.modelPath;
              // "/models/nature/Flower_3_Single.gltf"; // <<< Default/Test Path
              if (!modelPath) {
                console.warn(
                  `[${instanceId}] No modelPath found for loot item ${itemConfig.itemId}. Skipping drop.`
                );
                continue; // Skip if no model path defined
              }

              try {
                // Load the loot model
                // Use await here as loading is async. The forEach callback needs to be async.
                const { model: lootModel } =
                  await this.resourceManager.loadModel({ path: modelPath });
                if (!lootModel) continue; // Skip if model failed to load

                lootModel.position.set(spawnX, spawnY, spawnZ);
                // Optional: Adjust loot scale or rotation
                lootModel.scale.set(0.5, 0.5, 0.5); // Scale adjustment
                lootModel.name = `Loot_${itemConfig.itemId}`;
                lootModel.castShadow = true;
                this.sceneManager.add(lootModel);

                // Create physics body for the loot
                const lootBodyOptions = {
                  shape: "box", // Simple shape for flower base? Or sphere?
                  hx: 0.2,
                  hy: 0.25,
                  hz: 0.2, // Small half-extents
                  mass: 0.5, // Small mass to settle
                  position: { x: spawnX, y: spawnY + 0.15, z: spawnZ - 0.3 }, // Center physics body
                  friction: 0.8,
                  restitution: 0.1,
                  threeObject: lootModel,
                  // Add components needed for interaction system
                  interactionType: "collectable", // <<< Mark as collectable
                  lootItemId: itemConfig.itemId, // Pass item ID for LootComponent
                  lootQuantity: 1, // Each physics body represents 1 item stack
                };
                const lootBody = this.physicsEngine.createBody(lootBodyOptions);

                if (lootBody) {
                  // Link components created inside createBody
                  lootModel.userData.physicsBody = lootBody;

                  // TESTING: Add LootComponent to physics body
                  // --- ***** EXPLICITLY ADD LootComponent ***** ---
                  lootBody.userData.lootComponent = new LootComponent(
                    itemConfig.itemId, // Get ID from loot table config
                    1 // Quantity is 1 per loot object instance
                  );
                  // --- ***** END ADD LootComponent ***** ---

                  // Add to InteractionSystem tracking if needed (check InteractionSystem structure)
                  // Assuming InteractionSystem has a method or array like `collectableItems`
                  // Add to InteractionSystem tracking
                  if (
                    this.interactionSystem &&
                    Array.isArray(this.interactionSystem.collectableItems)
                  ) {
                    this.interactionSystem.collectableItems.push(lootBody);
                    console.log(
                      `[${instanceId}] Added ${itemConfig.itemId} loot body to InteractionSystem tracking.`
                    );
                  }
                } else {
                  console.error(
                    `[${instanceId}] Failed to create physics body for loot ${itemConfig.itemId}. Cleaning up visual.`
                  );
                  this.sceneManager.remove(lootModel);
                  // Dispose geometry/material if appropriate
                }
              } catch (loadError) {
                console.error(
                  `[${instanceId}] Error loading loot model ${modelPath}:`,
                  loadError
                );
              }
            } // end for quantity loop
          } // end if chance check
        }); // end forEach lootTable item
      }
      // --- ***** END Process Loot Drop ***** ---

      // 4. Set Timer for Delayed Removal
      const removalDelayMs = 60000; // 60-second delay
      console.log(
        `[${instanceId}] Scheduling removal in ${
          removalDelayMs / 1000
        } seconds.`
      );

      setTimeout(() => {
        // Retrieve the latest info inside the callback
        const currentEnemyInfo = this.activeEnemies.get(instanceId);
        if (!currentEnemyInfo) {
          console.warn(
            `[${instanceId}] Enemy info missing at time of removal timeout (already removed?).`
          );
          return;
        }
        console.log(
          `%c[${instanceId}] Executing delayed removal callback.`,
          "color: grey;"
        );

        const currentModel = currentEnemyInfo.model;
        const currentPhysicsBody = currentEnemyInfo.physicsBody;

        // PRE-REMOVAL CHECKS
        console.log(`[${instanceId}] State right before attempting removal:`, {
          modelExists: !!currentModel,
          // Check if the model is still part of the scene graph
          isModelInScene: !!currentModel?.parent,
          modelVisibility: currentModel?.visible, // Check visibility flag
          bodyExists: !!currentPhysicsBody,
        });

        // --- Cleanup Steps with Individual Error Handling ---
        try {
          if (currentModel) {
            const mixer = currentModel.userData?.animationFSM?._mixer;
            if (mixer && this.animationSystem) {
              this.animationSystem.unregisterMixer(mixer);
              console.log(`[${instanceId}] Animation mixer unregistered.`);
            }
            // Remove from scene ONLY IF it's still in the scene
            if (this.sceneManager && currentModel.parent) {
              // <<< CHECK parent
              this.sceneManager.remove(currentModel);
              console.log(
                `[${instanceId}] sceneManager.remove(currentModel) called.`
              );
            } else if (!this.sceneManager) {
              console.error(
                `[${instanceId}] SceneManager reference missing during cleanup.`
              );
            } else if (!currentModel.parent) {
              // Log if it was already removed before this callback ran
              console.warn(
                `[${instanceId}] Model was already removed from scene before delayed cleanup.`
              );
            }
            // TODO: Consider geometry/material disposal
          } else {
            console.warn(
              `[${instanceId}] Model reference missing during cleanup timeout.`
            );
          }
        } catch (e) {
          console.error(
            `[${instanceId}] Error during model/animation cleanup:`,
            e
          );
        }

        try {
          if (currentPhysicsBody && this.physicsEngine) {
            this.physicsEngine.removeBody(currentPhysicsBody);
            // The log for actual removal is now inside PhysicsEngine.removeBody
            console.log(
              `[${instanceId}] physicsEngine.removeBody(currentPhysicsBody) called.`
            );
          } // ... error handling ...
        } catch (e) {
          console.error(
            `[${instanceId}] Error during physics body removal call:`,
            e
          );
        }

        try {
          if (this.aiSystem) {
            this.aiSystem.unregisterEnemy(instanceId);
            console.log(`[${instanceId}] Enemy unregistered from AI system.`);
          } // ... error handling ...
        } catch (e) {
          console.error(`[${instanceId}] Error during AI unregister:`, e);
        }

        try {
          const deleted = this.activeEnemies.delete(instanceId);
          if (deleted) {
            console.log(
              `[${instanceId}] Enemy removed from active map. Remaining: ${this.activeEnemies.size}`
            );
          } // ... error handling ...
        } catch (e) {
          console.error(`[${instanceId}] Error during active map delete:`, e);
        }

        console.log(`[${instanceId}] Enemy removal callback finished.`);
      }, removalDelayMs);
    } else {
      console.warn(
        `EnemyManager: Could not find active enemy info for died instance: ${instanceId}.`
      );
    }
  }
  // TODO: Add method to get active enemies, update logic etc.
}

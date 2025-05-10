// src/systems/InteractionSystem.js
import * as THREE from "three";
import eventBus from "../core/EventBus.js";
import { PLAYER_CONFIG } from "../config/PlayerConfig.js";
import {
  fallingLogMaterial,
  depletedRockMaterial,
} from "../config/MaterialConfig.js";
// Import Components needed for checks
// import { HealthComponent } from "../game/components/HealthComponent.js";
import { InteractableComponent } from "../game/components/InteractableComponent.js";
import { ResourceNodeComponent } from "../game/components/ResourceNodeComponent.js";
import { StatsComponent } from "../game/components/StatsComponent.js";
import { LootComponent } from "../game/components/LootComponent.js";

import { getItemData } from "../config/ItemConfig.js";

/**
 * Handles interactions between game entities triggered by events or checks.
 * Deals with attacks hitting resources/enemies, applying damage, triggering effects.
 */
export class InteractionSystem {
  /** @type {PhysicsEngine | null} */
  physicsEngine = null;
  /** @type {InstancedManager | null} */
  instancedManager = null;
  /** @type {SceneManager | null} */
  sceneManager = null;
  /** @type {UIManager | null} */
  uiManager = null;
  /** @type {THREE.Object3D | null} Reference to the player entity's visual object */
  playerRef = null; // Set via setPlayerReference
  /** @type {import('../core/ResourceManager.js').ResourceManager | null} */
  resourceManager = null;
  /** @type {import('../Game.js').Game | null} */
  gameInstance = null;

  /** @type {Ammo.btRigidBody | null} Body of the closest collectable item */
  closestCollectable = null;
  /** @type {Ammo.btRigidBody | null} Body of the resource node currently targeted by attack raycast */
  targetedResource = null;

  // Reusable THREE objects
  _forward = new THREE.Vector3();
  _rayStart = new THREE.Vector3(); // Still potentially useful for other things
  _rayEnd = new THREE.Vector3(); // Still potentially useful for other things
  _pushDirection = new THREE.Vector3();
  _targetPosition = new THREE.Vector3();
  _playerPosition = new THREE.Vector3(); // To store player position
  _itemPosition = new THREE.Vector3(); // To store item position

  /** @type {Array<Ammo.btRigidBody>} List of active collectable item physics bodies */
  collectableItems = []; // List to track items

  /** @type {import('./SoundManager.js').SoundManager | null} */ // SoundManager Type Hint
  soundManager = null; // soundManager property

  /**
   * @param {PhysicsEngine} physicsEngine
   * @param {InstancedManager} instancedManager
   * @param {SceneManager} sceneManager
   * @param {UIManager} uiManager
   * @param {ResourceManager} resourceManager
   * @param {import('../Game.js').Game} gameInstance
   */
  constructor(
    physicsEngine,
    instancedManager,
    sceneManager,
    uiManager,
    resourceManager,
    gameInstance,
    soundManager
  ) {
    this.physicsEngine = physicsEngine;
    this.instancedManager = instancedManager;
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;
    this.resourceManager = resourceManager;
    this.gameInstance = gameInstance;
    this.soundManager = soundManager; // <<< STORE soundManager reference

    if (!this.soundManager)
      console.warn("InteractionSystem: SoundManager reference not provided!"); // Add warning

    this.collectableItems = []; // Initialize array

    // Subscribe to events
    eventBus.on("playerAttack", this.handlePlayerAttack.bind(this));
    eventBus.on("playerInteract", this.handlePlayerInteract.bind(this));

    eventBus.on("itemDropped", this.handleItemDropped.bind(this));

    console.log(
      "InteractionSystem initialized and listening for 'playerAttack' event."
    );
  }

  /** Stores a reference to the player object once it's loaded */
  setPlayerReference(player) {
    this.playerRef = player;
    console.log("InteractionSystem: Player reference set.");
  }

  /**
   * Handles the 'playerAttack' event emitted by PlayerController.
   * Performs raycast and processes hits for enemies or resources.
   * @param {object} eventData - Data emitted with the event.
   * @param {THREE.Object3D} eventData.attacker - The visual object of the attacker.
   * @param {Ammo.btRigidBody} eventData.attackerBody - The physics body of the attacker.
   */
  handlePlayerAttack(eventData) {
    // --- 1. Initial Setup & Validation ---
    const attacker = eventData?.attacker || this.playerRef;
    // Ensure we exclude the correct physics body
    const attackerBody =
      eventData?.attackerBody || this.playerRef?.userData?.physicsBody;

    if (!attacker || !this.physicsEngine || !this.uiManager || !attackerBody) {
      console.warn(
        "InteractionSystem: Cannot handle attack without attacker, physics, UI manager, or attacker body."
      );
      return;
    }

    // --- 2. Perform Raycast ---
    attacker.getWorldDirection(this._forward);
    attacker.getWorldPosition(this._rayStart);
    this._rayStart.y += 1.0; // Approx chest height
    this._rayStart.addScaledVector(this._forward, 0.1);
    this._rayEnd
      .copy(this._rayStart)
      .addScaledVector(this._forward, PLAYER_CONFIG.ATTACK_RANGE);

    // Update raycast call and result handling >>>
    const hitResult = this.physicsEngine.raycast(
      this._rayStart,
      this._rayEnd,
      attackerBody
    );
    const hitBody = hitResult?.body; // Get the body from the result object

    // --- 3. Handle No Hit ---
    if (!hitBody?.userData) {
      // Check hitBody exists before accessing userData
      this.uiManager.log("Attack Missed.");
      // Clean up Ammo vectors if hitResult exists but body is null/invalid
      if (hitResult) {
        Ammo.destroy(hitResult.point);
        Ammo.destroy(hitResult.normal);
      }
      return;
    }

    // --- Process Hit ---
    const userData = hitBody.userData;
    const interactableComp = userData.interactableComponent;
    const healthComp = userData.healthComponent;
    const isEnemy = interactableComp?.type === "enemy";
    const isResource =
      healthComp &&
      (interactableComp?.type === "cuttable" ||
        interactableComp?.type === "mineable");

    // Determine name
    const hitObjectName =
      userData.nodeName ||
      (isEnemy ? "Enemy" : null) ||
      userData.threeObject?.name ||
      (isResource ? "Resource" : null) ||
      "Object";

    this.uiManager.log(`Attack Hit: ${hitObjectName}`);

    // --- Handle Damageable Targets (Enemy or Resource) ---
    if (healthComp && (isEnemy || isResource)) {
      const attackerStatsComp =
        eventData.attacker?.userData?.stats || this.playerRef?.userData?.stats;
      if (!attackerStatsComp) {
        console.error("Player attacker missing StatsComponent!");
        // Optionally hide bar if we can't process damage?
        if (this.uiManager.trackedHealthComponent)
          this.uiManager.hideTargetHealth();
        return;
      }
      const damageDealt =
        attackerStatsComp.currentDamage || PLAYER_CONFIG.ATTACK_DAMAGE;

      // --- UI Interaction ---
      // 1. Show the bar (sets label, makes visible, resets hide timer)
      this.uiManager.showTargetHealth(healthComp, hitObjectName);

      console.log(
        `[InteractionSystem] Attempting to play sound. AudioContext state: ${this.soundManager?.listener?.context?.state}`
      ); // Check context state
      // --- Play Specific Sound Based on Type ---
      if (interactableComp?.type === "cuttable") {
        console.log(interactableComp?.type);
        this.gameInstance?.soundManager?.playSound("hit_wood"); // Use optional chaining
      } else if (interactableComp?.type === "mineable") {
        console.log(interactableComp?.type);
        this.gameInstance?.soundManager?.playSound("hit_rock"); // Use optional chaining
      }
      // this works for now.
      console.log(
        `[InteractionSystem] Attempting to play sound. AudioContext state: ${this.soundManager?.listener?.context?.state}`
      ); // Check context state
      // try {
      //   this.gameInstance?.soundManager?.playSound("hit_wood"); // Use optional chaining
      // } catch (e) {
      //   console.error("InteractionSystem: Failed to play sound:", e);
      // }

      // 2. Apply Damage
      const died = healthComp.takeDamage(damageDealt);
      console.log(
        `${hitObjectName} health after damage: ${healthComp.currentHealth}/${healthComp.maxHealth}`
      ); // Log health state *after* damage

      // 3. Update Bar Fill Percentage *AFTER* damage is applied
      this.uiManager.updateTargetHealth(); // <<< This now shows the health AFTER the hit

      // 4. Log combat message
      if (!died) {
        this.uiManager.log(
          `Damaged ${hitObjectName} for ${damageDealt}!`,
          "lightblue"
        );
      } else {
        this.uiManager.log(`${hitObjectName} was defeated!`);
      }

      // 5. Handle Death/Depletion (if applicable)
      if (died) {
        if (isEnemy) {
          // Let the 'enemyDied' event handle cleanup via EnemyManager
          // DO NOT hide health bar here, let the timer or cleanup handle it
          console.log(
            `Enemy defeat signal should be emitted by HealthComponent for ${
              userData.instanceId || hitObjectName
            }`
          );
          setTimeout(() => {
            this.uiManager.hideTargetHealth();
          }, 500);
        } else if (isResource) {
          this.handleNodeDepletion(hitBody); // Handle resource depletion logic
          // Hide resource bar immediately after depletion starts? Or let timer handle it?
          setTimeout(() => {
            this.uiManager.hideTargetHealth();
          }, 500);
          // this.uiManager.hideTargetHealth(); // Optional immediate hide
        }
      }
      // Destroy hitResult vectors before returning >>>
      Ammo.destroy(hitResult.point);
      Ammo.destroy(hitResult.normal);
      return; // Handled damageable hit
    }

    // --- Handle Non-Damageable Hits ---
    // ... (Log non-damageable, non-interactable hits) ...
    // Hide health bar if it was showing a different target previously
    if (
      this.uiManager.trackedHealthComponent &&
      this.uiManager.trackedHealthComponent !== healthComp
    ) {
      this.uiManager.hideTargetHealth();
    }
    // Destroy hitResult vectors if not used >>>
    Ammo.destroy(hitResult.point);
    Ammo.destroy(hitResult.normal);
  } // End handlePlayerAttack

  /**
   * Handles logic when a resource node (tree, rock) is depleted.
   * @param {Ammo.btRigidBody} targetBody - The physics body of the depleted node.
   */

  handleNodeDepletion(targetBody) {
    // ... (initial checks for targetBody, components etc.) ...
    if (
      !targetBody?.userData ||
      !this.physicsEngine ||
      !this.instancedManager ||
      !this.sceneManager ||
      !this.playerRef ||
      !this.uiManager ||
      !this.gameInstance // *** ADDED: Check for gameInstance ***
    )
      return;
    const interactableComp = targetBody.userData.interactableComponent;
    const healthComp = targetBody.userData.healthComponent;
    const resourceComp = targetBody.userData.resourceNodeComponent;
    const instanceId = targetBody.userData.instanceId; // *** ADDED: Get instance ID ***

    // Check if health is depleted
    if (!interactableComp || !healthComp || !healthComp.isDead()) return;

    // --- Add to Permanently Depleted Set ---
    if (
      instanceId &&
      !this.gameInstance.permanentlyDepletedNodeIds.has(instanceId)
    ) {
      this.gameInstance.permanentlyDepletedNodeIds.add(instanceId);
      console.log(`Added ${instanceId} to permanently depleted nodes.`);
    }
    // --- End Add to Set ---

    // --- Check if it's a static object (meaning it hasn't been processed yet) ---
    if (targetBody.isStaticObject()) {
      this.uiManager?.log(`Node Depleted: ${interactableComp.type}`);
      const transform = this.physicsEngine.tempTransform;
      targetBody.getMotionState()?.getWorldTransform(transform) ||
        targetBody.getWorldTransform(transform);
      const origin = transform.getOrigin();

      // --- Type-Specific Effect ---
      if (interactableComp.type === "cuttable" && resourceComp) {
        const lootItemId = resourceComp.resourceId || "wood_log";
        const lootQuantity = resourceComp.quantity || 1; // Note: we spawn 1 visual/physics body per unit
        console.log(
          `InteractionSystem: Cutting Tree to drop ${lootQuantity}x ${lootItemId}...`
        );

        const originalPosition = new THREE.Vector3(
          origin.x(),
          origin.y(),
          origin.z()
        );
        this.instancedManager.hideInstance(targetBody); // Hide original visual
        this.physicsEngine.removeBody(targetBody); // Remove original physics

        // --- Spawn Loot Logs ---
        for (let i = 0; i < lootQuantity; i++) {
          // Slightly randomize spawn position for multiple logs
          const spawnOffset = 0.4;
          const spawnX =
            originalPosition.x + (Math.random() - 0.5) * spawnOffset;
          const spawnZ =
            originalPosition.z + (Math.random() - 0.5) * spawnOffset;
          const terrainY = this.physicsEngine.getHeightAt(spawnX, spawnZ);
          const spawnY = (terrainY ?? originalPosition.y) + 0.5; // Spawn slightly above ground

          const logRadius = 0.3;
          const logHeight = 2.0; // Smaller log size?
          const lootLogGeometry = new THREE.CylinderGeometry(
            logRadius,
            logRadius,
            logHeight,
            8
          );
          const lootLogMaterial = fallingLogMaterial; // Re-use material
          const lootLogMesh = new THREE.Mesh(lootLogGeometry, lootLogMaterial);
          lootLogMesh.rotation.z = Math.PI; // / 2 = Rotate to lie flat on X-axis
          lootLogMesh.position.set(spawnX, spawnY, spawnZ);
          lootLogMesh.castShadow = true;
          lootLogMesh.name = `Loot_${lootItemId}_${i}`;
          this.sceneManager.add(lootLogMesh);

          // Define a model path (even if simple geometry) for potential saving/loading reference
          const modelPath = "primitive://cylinder";

          const lootLogBodyOptions = {
            shape: "capsule", // Capsule along Z axis after rotation
            radius: logRadius,
            height: logHeight - 2 * logRadius,
            mass: 5,
            position: { x: spawnX, y: spawnY, z: spawnZ },
            quaternion: {
              x: lootLogMesh.quaternion.x,
              y: lootLogMesh.quaternion.y,
              z: lootLogMesh.quaternion.z,
              w: lootLogMesh.quaternion.w,
            },
            friction: 0.7,
            restitution: 0.2,
            threeObject: lootLogMesh,
            // --- Store modelPath in userData
            modelPath: modelPath,
          };
          const lootLogBody = this.physicsEngine.createBody(lootLogBodyOptions);

          if (lootLogBody) {
            lootLogBody.userData.interactableComponent =
              new InteractableComponent("collectable");
            lootLogBody.userData.lootComponent = new LootComponent(
              lootItemId,
              1
            ); // Each body represents 1 unit
            lootLogBody.userData.modelPath = modelPath; // <<< Store path here too
            lootLogMesh.userData.physicsBody = lootLogBody;
            this.collectableItems.push(lootLogBody); // Add to tracking
          } else {
            /* Handle error, cleanup mesh */
            console.error(
              `Failed to create physics body for ${lootItemId} loot.`
            );
            this.sceneManager.remove(lootLogMesh);
            lootLogGeometry.dispose();
          }
        }
        this.uiManager?.log(
          `Spawned ${lootQuantity}x ${lootItemId} to collect.`
        );
      } else if (interactableComp.type === "mineable" && resourceComp) {
        // ... (similar logic for spawning rocks/ore loot) ...
        // Remember to add modelPath and push to this.collectableItems
        const lootItemId = resourceComp.resourceId || "stone";
        const lootQuantity = resourceComp.quantity || 1;
        // ... (get original position, remove old body/visual) ...
        const originalPosition = new THREE.Vector3(
          origin.x(),
          origin.y(),
          origin.z()
        );
        this.instancedManager.hideInstance(targetBody);
        this.physicsEngine.removeBody(targetBody);

        for (let i = 0; i < lootQuantity; i++) {
          // ... (calculate randomized spawn position) ...
          const spawnOffset = 0.3;
          const spawnX =
            originalPosition.x + (Math.random() - 0.5) * spawnOffset;
          const spawnZ =
            originalPosition.z + (Math.random() - 0.5) * spawnOffset;
          const terrainY = this.physicsEngine.getHeightAt(spawnX, spawnZ);
          const spawnY = (terrainY ?? originalPosition.y) + 0.3;

          const lootGeometry = new THREE.IcosahedronGeometry(0.3, 0);
          const lootMaterial = depletedRockMaterial; // Placeholder
          const lootMesh = new THREE.Mesh(lootGeometry, lootMaterial);
          //  set position, shadow, name
          lootMesh.position.set(spawnX, spawnY, spawnZ);
          lootMesh.castShadow = true;
          lootMesh.name = `Loot_${lootItemId}_${i}`;
          this.sceneManager.add(lootMesh);

          const modelPath = "primitive://icosahedron";

          const lootBodyOptions = {
            shape: "sphere",
            radius: 0.3,
            mass: 1,
            position: { x: spawnX, y: spawnY, z: spawnZ },
            threeObject: lootMesh,
            modelPath: modelPath,
          };
          const lootBody = this.physicsEngine.createBody(lootBodyOptions);
          if (lootBody) {
            lootBody.userData.interactableComponent = new InteractableComponent(
              "collectable"
            );
            lootBody.userData.lootComponent = new LootComponent(lootItemId, 1);
            lootBody.userData.modelPath = modelPath; // <<< Store path
            lootMesh.userData.physicsBody = lootBody;
            this.collectableItems.push(lootBody); // Add to tracking
          } else {
            /* Handle error, cleanup mesh */
            console.error(
              `Failed to create physics body for ${lootItemId} loot.`
            );
            this.sceneManager.remove(lootMesh);
            lootGeometry.dispose();
          }
        }
        this.uiManager?.log(
          `Spawned ${lootQuantity}x ${lootItemId} to collect.`
        );
      }
    }
    // Else: Already dynamic (e.g., tree part falling), or not static - ignore for spawning loot.
  } // End handleNodeDepletion

  async handleItemDropped(eventData) {
    const { itemId, quantity, itemData } = eventData;
    if (
      !itemId ||
      quantity <= 0 ||
      !this.playerRef ||
      !this.physicsEngine ||
      !this.sceneManager
    ) {
      console.error(
        "InteractionSystem: Invalid data for item drop or missing system references."
      );
      return;
    }

    const fullItemData = getItemData(itemId); // Get full data including modelPath, weight etc.
    if (!fullItemData) {
      console.error(
        `InteractionSystem: Cannot drop item, invalid item ID: ${itemId}`
      );
      return;
    }

    console.log(`InteractionSystem: Handling drop of ${quantity}x ${itemId}`);

    // --- Determine Drop Position (in front of player) ---
    const playerPos = new THREE.Vector3();
    const playerDir = new THREE.Vector3();
    this.playerRef.getWorldPosition(playerPos);
    this.playerRef.getWorldDirection(playerDir);
    const dropOffset = 1.0; // How far in front to drop
    const dropHeightOffset = 2; // How high above ground to drop initially
    const dropPosition = new THREE.Vector3()
      .copy(playerPos)
      .addScaledVector(playerDir, dropOffset);

    // Get terrain height at the drop location
    const terrainY = this.physicsEngine.getHeightAt(
      dropPosition.x,
      dropPosition.z
    );
    dropPosition.y =
      (terrainY !== null ? terrainY : playerPos.y) + dropHeightOffset; // Use terrain height or player height as fallback
    console.log(`Dropped item Y: ${dropPosition.y}`);
    // --- Spawn Item(s) in World ---
    // Spawn one physics/visual object per unit quantity for simplicity now
    // TODO: Could spawn one object with quantity > 1 later
    for (let i = 0; i < quantity; i++) {
      const modelPath = fullItemData.modelPath;
      if (!modelPath) {
        console.warn(
          `No modelPath for dropped item ${itemId}, skipping visual.`
        );
        continue; // Or create a generic placeholder mesh
      }

      let droppedMesh;
      let droppedGeometry; // Track geometry for disposal on error
      let bodyShape = "box"; // Default shape
      let bodySize = { hx: 0.15, hy: 0.15, hz: 0.15 }; // Default size

      try {
        // --- Create Visual ---
        if (modelPath.startsWith("primitive://")) {
          const type = modelPath.split("://")[1];
          if (type === "cylinder") {
            droppedGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 8); // Log size
            droppedMesh = new THREE.Mesh(
              droppedGeometry,
              /* Get log material */ new THREE.MeshStandardMaterial({
                color: 0x8b4513,
              })
            );
            droppedMesh.rotation.z = Math.PI / 2; // Lie flat
            // bodyShape = "capsule";
            // bodySize = { radius: 0.12, height: 1.0 - 0.24 };
            const visualRadius = 0.33;
            const visualHeight = 2.5;
            bodyShape = "capsule";
            // Use dimensions closer to the visual mesh, maybe slightly smaller for stability
            bodySize = {
              radius: visualRadius * 0.9,
              height: visualHeight - visualRadius * 0.9 * 2,
            };
          } else {
            // Assume icosahedron for stone/ore
            droppedGeometry = new THREE.IcosahedronGeometry(0.2, 0);
            droppedMesh = new THREE.Mesh(
              droppedGeometry,
              /* Get stone/ore material */ new THREE.MeshStandardMaterial({
                color: 0x777777,
              })
            );
            bodyShape = "sphere";
            bodySize = { radius: 0.2 };
          }
        } else {
          // Load model using ResourceManager
          const { model } = await this.resourceManager.loadModel({
            path: modelPath,
          });
          droppedMesh = model;
          // Estimate physics size from loaded model bounding box
          const box = new THREE.Box3().setFromObject(droppedMesh);
          const size = box.getSize(new THREE.Vector3());
          bodyShape = "box"; // Or capsule based on size?
          bodySize = {
            hx: size.x / 4 || 0.2,
            hy: size.y / 4 || 0.25,
            hz: size.z / 4 || 0.2,
          };
        }

        if (!droppedMesh) continue; // Skip if mesh creation failed

        // Slightly randomize drop position per item
        const randOffset = 0.2;
        const finalDropPos = dropPosition.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * randOffset,
            (Math.random() - 0.2) * randOffset, // Allow slight Y variance too
            (Math.random() - 0.5) * randOffset
          )
        );
        // Clamp Y position to be slightly above ground after randomization
        finalDropPos.y = Math.max(
          (terrainY ?? playerPos.y) + 0.5,
          finalDropPos.y
        );

        droppedMesh.position.copy(finalDropPos);
        droppedMesh.castShadow = true;
        droppedMesh.name = `Dropped_${itemId}`;
        this.sceneManager.add(droppedMesh);

        // --- Create Physics Body ---
        const bodyOptions = {
          shape: bodyShape,
          ...bodySize, // Spread computed size/radius
          mass: fullItemData.weight || 0.5, // Use item weight for mass? Min mass?
          position: { x: finalDropPos.x, y: finalDropPos.y, z: finalDropPos.z },
          friction: 0.6,
          restitution: 0.3,
          threeObject: droppedMesh,
          modelPath: modelPath, // Store for potential saving
        };
        const droppedBody = this.physicsEngine.createBody(bodyOptions);

        if (droppedBody) {
          droppedBody.userData.interactableComponent =
            new InteractableComponent("collectable");
          droppedBody.userData.lootComponent = new LootComponent(itemId, 1); // Each dropped body is 1 item
          droppedBody.userData.modelPath = modelPath; // Store path
          droppedMesh.userData.physicsBody = droppedBody;
          this.collectableItems.push(droppedBody); // Add to tracking for pickup
          // Apply a small initial impulse? Optional.
          // const impulse = new Ammo.btVector3((Math.random()-0.5)*1, 0.5, (Math.random()-0.5)*1);
          // droppedBody.applyCentralImpulse(impulse);
          // Ammo.destroy(impulse);
        } else {
          console.error(
            `Failed to create physics body for dropped ${itemId}. Cleaning visual.`
          );
          this.sceneManager.remove(droppedMesh);
          droppedGeometry?.dispose();
        }
      } catch (error) {
        console.error(
          `Error processing drop for ${itemId} (model: ${modelPath}):`,
          error
        );
        if (droppedMesh && droppedMesh.parent)
          this.sceneManager.remove(droppedMesh);
        droppedGeometry?.dispose();
      }
    } // End loop for quantity
  }

  /**
   * Spawns loot items based on data loaded from a save file.
   * @param {Array<object>} lootDataArray - Array of loot item data objects.
   */
  async spawnLoadedLoot(lootDataArray = []) {
    if (!this.resourceManager || !this.physicsEngine || !this.sceneManager) {
      console.error("Cannot spawn loaded loot: Missing required managers.");
      return;
    }
    if (lootDataArray.length === 0) {
      console.log("No saved loot items to spawn.");
      return;
    }

    console.log(`Spawning ${lootDataArray.length} loaded loot items...`);
    this.uiManager?.log(`Spawning ${lootDataArray.length} saved items...`);

    // Clear existing collectables before spawning loaded ones? Or merge?
    // Clearing is simpler to avoid duplicates if loading happens after some gameplay.
    // However, this requires robust cleanup of existing items first.
    // For now, let's assume we clear existing dynamic loot before loading.
    this.clearAllCollectableItems(); // Implement this helper method below

    for (const lootData of lootDataArray) {
      if (!lootData.itemId || !lootData.position || !lootData.rotation) {
        console.warn("Skipping invalid loaded loot data:", lootData);
        continue;
      }

      try {
        let lootMesh;
        let lootGeometry; // Keep track for potential disposal on error
        const modelPath = lootData.modelPath; // Get saved path

        // --- Create Visual Mesh ---
        // Check if it's a primitive or a loaded model
        if (modelPath?.startsWith("primitive://")) {
          const type = modelPath.split("://")[1];
          // TODO: Refine primitive creation based on saved data/type
          if (type === "cylinder") {
            lootGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 8);
            lootMesh = new THREE.Mesh(lootGeometry, fallingLogMaterial);
            // Apply saved rotation correctly to the mesh BEFORE creating physics body
            lootMesh.quaternion.set(
              lootData.rotation.x,
              lootData.rotation.y,
              lootData.rotation.z,
              lootData.rotation.w
            );
          } else {
            // Assume icosahedron for rocks/ore
            lootGeometry = new THREE.IcosahedronGeometry(0.3, 0);
            // TODO: Use appropriate material based on itemId
            lootMesh = new THREE.Mesh(lootGeometry, depletedRockMaterial);
            lootMesh.quaternion.set(
              lootData.rotation.x,
              lootData.rotation.y,
              lootData.rotation.z,
              lootData.rotation.w
            );
          }
        } else if (modelPath) {
          // Load model from path (ensure resourceManager is available)
          const { model } = await this.resourceManager.loadModel({
            path: modelPath,
          });
          lootMesh = model;
          if (!lootMesh) throw new Error(`Failed to load model: ${modelPath}`);
          lootMesh.quaternion.set(
            lootData.rotation.x,
            lootData.rotation.y,
            lootData.rotation.z,
            lootData.rotation.w
          );
        } else {
          // Fallback if no path - create placeholder (e.g., small sphere)
          console.warn(
            `No modelPath for saved loot ${lootData.itemId}, creating placeholder.`
          );
          lootGeometry = new THREE.SphereGeometry(0.2);
          lootMesh = new THREE.Mesh(
            lootGeometry,
            new THREE.MeshStandardMaterial({ color: 0xff00ff })
          );
          lootMesh.quaternion.set(
            lootData.rotation.x,
            lootData.rotation.y,
            lootData.rotation.z,
            lootData.rotation.w
          );
        }

        lootMesh.position.set(
          lootData.position.x,
          lootData.position.y,
          lootData.position.z
        );
        lootMesh.castShadow = true;
        lootMesh.name = `LoadedLoot_${lootData.itemId}`;
        this.sceneManager.add(lootMesh);

        // --- Create Physics Body ---
        // Determine shape based on primitive type or default for loaded models
        let bodyOptions = {
          // Defaults, adjust based on item type
          shape: "sphere",
          radius: 0.3,
          mass: 1,
          position: lootData.position,
          quaternion: lootData.rotation, // Use loaded rotation
          friction: 0.7,
          restitution: 0.2,
          threeObject: lootMesh,
          modelPath: modelPath, // Store path again for consistency
        };
        if (modelPath === "primitive://cylinder") {
          bodyOptions.shape = "capsule";
          bodyOptions.radius = 0.3; // Match geometry
          bodyOptions.height = 2.0 - 2 * 0.3; // Match geometry
        } else if (modelPath === "primitive://icosahedron") {
          bodyOptions.shape = "sphere"; // Or maybe convex hull later?
          bodyOptions.radius = 0.3; // Match geometry
        }
        // Add more shape logic if loading complex models

        const lootBody = this.physicsEngine.createBody(bodyOptions);

        if (lootBody) {
          lootBody.userData.interactableComponent = new InteractableComponent(
            "collectable"
          );
          // Use loaded quantity, default to 1 if not present
          lootBody.userData.lootComponent = new LootComponent(
            lootData.itemId,
            lootData.quantity || 1
          );
          lootBody.userData.modelPath = modelPath;
          lootMesh.userData.physicsBody = lootBody;
          this.collectableItems.push(lootBody); // Add to tracking
        } else {
          console.error(
            `Failed to create physics body for loaded loot: ${lootData.itemId}`
          );
          this.sceneManager.remove(lootMesh);
          lootGeometry?.dispose(); // Dispose geometry if created here
        }
      } catch (error) {
        console.error(
          `Error spawning loaded loot item ${lootData.itemId}:`,
          error
        );
        // Attempt cleanup if mesh was created but physics failed
        if (lootMesh && lootMesh.parent) this.sceneManager.remove(lootMesh);
        lootGeometry?.dispose();
      }
    }
    console.log(
      `Finished spawning ${this.collectableItems.length} loaded loot items.`
    );
  }

  /** Helper to remove all currently tracked collectable items from physics and scene */
  clearAllCollectableItems() {
    console.log(
      `Clearing ${this.collectableItems.length} existing collectable items...`
    );
    // Iterate backwards as we are removing items from the array
    for (let i = this.collectableItems.length - 1; i >= 0; i--) {
      const body = this.collectableItems[i];
      const visualObject = body?.userData?.threeObject;

      if (visualObject && this.sceneManager) {
        this.sceneManager.remove(visualObject);
        // Optional: Dispose geometry/material if they aren't shared resources
        // visualObject.geometry?.dispose();
        // visualObject.material?.dispose();
      }
      if (body && this.physicsEngine) {
        this.physicsEngine.removeBody(body);
      }
    }
    this.collectableItems = []; // Clear the array
    console.log("Collectable items cleared.");
  }

  /**
   * Handles the 'playerInteract' event emitted by PlayerController.
   * Performs a raycast to find interactable objects.
   * @param {object} eventData - Data emitted with the event.
   * @param {THREE.Object3D} eventData.interactor - The visual object of the entity trying to interact.
   */
  // --- handlePlayerInteract uses Proximity Check ---
  /** Handles the 'playerInteract' event - now uses the pre-calculated closest item */
  handlePlayerInteract(eventData) {
    // Check if the update loop found a collectable item nearby
    if (this.closestCollectable) {
      const lootComp = this.closestCollectable.userData.lootComponent;
      const hitObjectName =
        this.closestCollectable.userData.threeObject?.name ||
        "collectable_item";
      // this.uiManager?.log(
      //   `Proximity: Attempting to collect ${lootComp.quantity}x ${lootComp.itemId} (${hitObjectName})`
      // );

      const playerInventory = this.playerRef?.userData?.inventory;
      if (playerInventory?.addItem) {
        const success = playerInventory.addItem(
          lootComp.itemId,
          lootComp.quantity
        );
        if (success) {
          this.uiManager?.log(
            `Collected ${lootComp.quantity}x ${lootComp.itemId}!`,
            "yellow"
          );
          const visualObject = this.closestCollectable.userData.threeObject;
          if (visualObject?.parent) this.sceneManager.remove(visualObject); // Check parent before removing
          this.physicsEngine.removeBody(this.closestCollectable);

          // Remove from tracking list
          const index = this.collectableItems.indexOf(this.closestCollectable);
          if (index > -1) this.collectableItems.splice(index, 1);

          this.closestCollectable = null; // Clear current target
          this.uiManager.setInteractionPrompt(""); // Clear prompt immediately
        } else {
          this.uiManager?.log("Inventory is full!", "red");
        }
      } else {
        console.error(
          "Player inventory component not found or missing addItem method!"
        );
      }
    } else {
      this.uiManager?.log("Interact: Nothing in pickup range."); // This log might be less frequent now
    }
  }

  /** Helper: Finds the closest collectable item within pickup range */
  _findClosestCollectable() {
    const pickupRadiusSq = 1.5 * 1.5; // Squared radius
    this.playerRef.getWorldPosition(this._playerPosition);
    let closestBody = null;
    let minDistanceSq = pickupRadiusSq;

    for (let i = this.collectableItems.length - 1; i >= 0; i--) {
      const itemBody = this.collectableItems[i];
      // Optional: Add validity check : if (!itemBody || itemBody.isDisposed) ... continue;
      if (!itemBody?.userData) continue; // Ensure userData exists

      const transform = itemBody.getWorldTransform();
      const origin = transform.getOrigin();
      this._itemPosition.set(origin.x(), origin.y(), origin.z());
      const distanceSq = this._playerPosition.distanceToSquared(
        this._itemPosition
      );

      if (distanceSq < minDistanceSq) {
        if (
          itemBody.userData.interactableComponent?.type === "collectable" &&
          itemBody.userData.lootComponent
        ) {
          minDistanceSq = distanceSq;
          closestBody = itemBody;
        }
      }
    }
    return closestBody;
  }

  /** Helper: Finds an attackable resource node via raycast */
  _findTargetedResource() {
    const attackerBody = this.playerRef?.userData?.physicsBody;
    if (!attackerBody) return null;

    const attackRange = PLAYER_CONFIG.ATTACK_RANGE;
    this.playerRef.getWorldDirection(this._forward);
    this.playerRef.getWorldPosition(this._rayStart);
    this._rayStart.y += 1.0; // Chest height approx
    this._rayStart.addScaledVector(this._forward, 0.1);
    this._rayEnd
      .copy(this._rayStart)
      .addScaledVector(this._forward, attackRange);

    // Update raycast call and result handling >>>
    const hitResult = this.physicsEngine.raycast(
      this._rayStart,
      this._rayEnd,
      attackerBody
    );
    let targetBody = null; // Variable to store the final body

    // Check if the hit body is a resource node that can be gathered
    if (hitResult?.body?.userData) {
      // Check if hitResult and body exist
      const body = hitResult.body;
      const interactableComp = body.userData.interactableComponent;
      const healthComp = body.userData.healthComponent;
      if (
        interactableComp &&
        healthComp &&
        healthComp.currentHealth > 0 &&
        (interactableComp.type === "cuttable" ||
          interactableComp.type === "mineable")
      ) {
        targetBody = body; // Store the valid target body
      }
    }
    // IMPORTANT: Clean up the Ammo vectors from the raycast result
    if (hitResult) {
      Ammo.destroy(hitResult.point);
      Ammo.destroy(hitResult.normal);
    }

    return targetBody; // Return the body if it's a valid, living resource node, otherwise null
  }

  /** Main update loop - performs checks for potential interactions */
  update(delta) {
    if (!this.playerRef || !this.physicsEngine || !this.uiManager) return;

    // --- 1. Check for Nearby Collectable Items (Proximity) ---
    this.closestCollectable = this._findClosestCollectable();

    // --- 2. Check for Targetable Resource Node (Raycast) ---
    this.targetedResource = this._findTargetedResource();

    // --- 3. Determine and Set Interaction Prompt ---
    let promptText = "";
    if (this.closestCollectable) {
      // Prioritize pickup prompt
      const lootComp = this.closestCollectable.userData?.lootComponent;
      const name =
        this.closestCollectable.userData?.threeObject?.name || "item";
      if (lootComp) {
        promptText = `[E] Collect ${lootComp.quantity}x ${lootComp.itemId}`; // (${name})
      }
    } else if (this.targetedResource) {
      // If no collectable nearby, check for targetable resource
      const resourceName =
        this.targetedResource.userData?.nodeName || "Resource";
      // Add health check - only show if it HAS health left
      const healthComp = this.targetedResource.userData?.healthComponent;
      if (healthComp && healthComp.currentHealth > 0) {
        promptText = `[Attack] Gather ${resourceName}`;
      }
    }

    // Update the static UI prompt via UIManager
    this.uiManager.setInteractionPrompt(promptText);
  }
} // End InteractionSystem class

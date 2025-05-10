// src/systems/PlacementSystem.js
import * as THREE from "three";
import eventBus from "../core/EventBus.js";
import { getItemData } from "../config/ItemConfig.js";
// import { InteractableComponent } from "../game/components/InteractableComponent.js";

export class PlacementSystem {
  /** @type {import('../Game.js').Game} */
  gameInstance;
  /** @type {import('../world/SceneManager.js').SceneManager | null} */
  sceneManager = null;
  /** @type {import('../physics/PhysicsEngine.js').PhysicsEngine | null} */
  physicsEngine = null;

  placementMaxDistance = 3.0; // How far in front the player can place

  // Store references to placed objects if they need saving/updating
  // placedObjects = [];
  activeCampfires = [];

  constructor(gameInstance) {
    this.gameInstance = gameInstance;
    this.sceneManager = gameInstance.sceneManager;
    this.physicsEngine = gameInstance.physicsEngine;

    this.activeCampfires = [];

    if (!this.sceneManager || !this.physicsEngine) {
      console.error("PlacementSystem: Missing SceneManager or PhysicsEngine!");
      return;
    }

    eventBus.on("placeItemAttempt", this.handlePlaceItem.bind(this));
    console.log(
      "PlacementSystem initialized and listening for 'placeItemAttempt'."
    );
  }

  handlePlaceItem(eventData) {
    const itemId = eventData?.itemId;
    const player = this.gameInstance?.playerController?.player;
    const inventory = player?.userData?.inventory;
    const uiManager = this.gameInstance?.uiManager;

    if (!itemId || !player || !inventory || !uiManager) {
      console.error("PlacementSystem: Missing data for placing item", itemId);
      return;
    }

    const itemData = getItemData(itemId);
    if (!itemData || itemData.type !== "placeable" || !itemData.placeableId) {
      console.warn(`Item ${itemId} is not a valid placeable item.`);
      return;
    }

    if (!inventory.hasItem(itemId, 1)) {
      uiManager.log(`You don't have a ${itemData.name} to place.`);
      return;
    }

    // 2. Determine Placement Position
    const playerPos = new THREE.Vector3();
    const playerDir = new THREE.Vector3();
    player.getWorldPosition(playerPos);
    player.getWorldDirection(playerDir);

    const rayStart = playerPos.clone().add(new THREE.Vector3(0, 0.5, 0));
    const rayEnd = rayStart
      .clone()
      .addScaledVector(playerDir, this.placementMaxDistance);

    const playerBody = this.gameInstance.playerController.physicsBody;
    // Update raycast call and result handling >>>
    const hitResult = this.physicsEngine.raycast(rayStart, rayEnd, playerBody);
    let hitBody = hitResult?.body; // Extract body

    let placePosition = null;
    let groundY = null;
    let targetX = null;
    let targetZ = null;

    // Check if hit something interactable (not terrain) or missed
    if (
      !hitResult ||
      (hitBody &&
        hitBody.userData?.threeObject !== this.gameInstance.terrain?.mesh)
    ) {
      if (hitBody) {
        // Hit something other than terrain
        uiManager.log("Cannot place item here (obstructed).");
        console.log(
          "Placement obstructed by:",
          hitBody.userData?.threeObject?.name
        );
        // Clean up vectors and return
        Ammo.destroy(hitResult.point);
        Ammo.destroy(hitResult.normal);
        return;
      } else {
        // Ray missed, place at max distance
        const endPoint = playerPos
          .clone()
          .addScaledVector(playerDir, this.placementMaxDistance);
        targetX = endPoint.x;
        targetZ = endPoint.z;
        groundY = this.physicsEngine.getHeightAt(targetX, targetZ); // Use existing height check for miss scenario
        console.log("Placement ray missed, placing at max distance on ground.");
      }
    } else if (
      hitResult &&
      hitBody.userData?.threeObject === this.gameInstance.terrain?.mesh
    ) {
      // Hit terrain, use exact hit point from raycast result
      targetX = hitResult.point.x();
      targetZ = hitResult.point.z();
      groundY = hitResult.point.y(); // <<< Use ACCURATE Y from hit point
      console.log(
        "Placement ray hit terrain. Using exact hit point Y:",
        groundY.toFixed(3)
      );
    }

    // IMPORTANT: Clean up Ammo vectors from raycast result (regardless of path taken)
    if (hitResult) {
      Ammo.destroy(hitResult.point);
      Ammo.destroy(hitResult.normal);
    }

    if (groundY === null) {
      uiManager.log("Cannot place item here (invalid ground).");
      console.warn(
        `Placement failed: No ground found at (${targetX?.toFixed(
          1
        )}, ${targetZ?.toFixed(1)})`
      );
      return;
    }
    placePosition = new THREE.Vector3(targetX, groundY, targetZ);

    // 3. Consume Item from Inventory
    const removed = inventory.removeItem(itemId, 1);
    if (!removed) {
      console.error(
        `Placement Error: Failed to remove ${itemId} from inventory.`
      );
      return;
    }

    // 4. Place the Object
    this.spawnPlacedObject(itemData.placeableId, placePosition);
    uiManager.log(`Placed ${itemData.name}.`);
  }

  /** Spawns the actual object in the world */
  spawnPlacedObject(placeableId, position) {
    if (placeableId === "campfire") {
      // Use SceneManager's helper to create the visual/light group
      const campfireObject = this.sceneManager?.createCampfireObject(position);
      if (campfireObject) {
        this.sceneManager.add(campfireObject); // Add the group to the scene
        campfireObject.visible = true;
        campfireObject.userData.light.visible = true;

        // --- Define desired capsule dimensions ---
        const desiredCapsuleRadius = 0.6; // The radius you want
        const desiredCylinderHeight = 0.1; // The height of the MIDDLE cylindrical part
        const totalCapsuleHeight =
          desiredCylinderHeight + 2 * desiredCapsuleRadius; // Cylinder + 2 half-spheres

        // Optional: Create a static physics body for collision/interaction
        const bodyOptions = {
          shape: "capsule",
          radius: desiredCapsuleRadius,
          height: totalCapsuleHeight, // Height of the cylindrical part ONLY
          mass: 0, // Static
          position: { x: position.x, y: position.y + 0.15, z: position.z }, // Center physics body
          threeObject: campfireObject, // Link to the group
          nodeId: `placed_${placeableId}_${Date.now()}`, // Unique ID
          nodeName: "Placed Campfire",
          // Add interactable component if campfires can be interacted with
          interactionType: "campfire_placed", // Interaction type
        };
        const physicsBody = this.physicsEngine?.createBody(bodyOptions);
        if (physicsBody) {
          campfireObject.userData.physicsBody = physicsBody;
          // Add components directly to body's userData if needed by physics interactions
          // physicsBody.userData.interactableComponent = new InteractableComponent('campfire_placed');
        }

        console.log(`Placed ${placeableId} at`, position);
        // Optional: Add to a list for saving/tracking placed objects
        // this.placedObjects.push({ id: placeableId, position: position, objectRef: campfireObject, bodyRef: physicsBody });
        // <<< Track the placed campfire >>>
        this.activeCampfires.push({
          object: campfireObject, // Store reference to the visual group
          body: physicsBody, // Store reference to the physics body (optional but useful)
          position: position.clone(), // Store its position
        });
        console.log(
          `Tracked placed campfire. Total active: ${this.activeCampfires.length}`
        );
      } else {
        console.error("Failed to create campfire object via SceneManager.");
      }
    }
    // Add else if for other placeableIds (e.g., 'tent', 'workbench')
  }

  // <<< Method to get active campfires >>>
  getActiveCampfires() {
    return this.activeCampfires;
  }

  // <<< Method to remove a campfire from tracking >>>
  removeCampfire(campfireToRemove) {
    // Call this if campfires can be destroyed or burn out
    this.activeCampfires = this.activeCampfires.filter(
      (cf) => cf.object !== campfireToRemove.object
    );
    // Also remove from scene and physics...
    if (campfireToRemove.object?.parent)
      this.sceneManager?.remove(campfireToRemove.object);
    if (campfireToRemove.body)
      this.physicsEngine?.removeBody(campfireToRemove.body);
    console.log(
      `Removed campfire from tracking. Remaining: ${this.activeCampfires.length}`
    );
  }

  // TODO: Add destroy method (remove listener)
  destroy() {
    eventBus.off("placeItemAttempt", this.handlePlaceItem.bind(this));
    console.log("PlacementSystem destroyed.");
  }
}

// src/setup/PlayerSetup.js
import * as THREE from "three";
import {
  PLAYER_MODEL_CONFIG,
  DEFAULT_MODEL_NORMALIZE_TARGET_HEIGHT,
} from "../config/ModelConfig.js";
import { PLAYER_CONFIG as P_CONFIG } from "../config/PlayerConfig.js";
import { PlayerController } from "../controllers/PlayerController.js";
import { HealthComponent } from "../game/components/HealthComponent.js";
import { StatsComponent } from "../game/components/StatsComponent.js";
import { InventoryComponent } from "../game/components/InventoryComponent.js";
import { AbilityComponent } from "../game/components/AbilityComponent.js";
import { EquipmentComponent } from "../game/components/EquipmentComponent.js";
import { ABILITIES } from "../config/AbilityConfig.js";
import { WeatherEffectComponent } from "../game/components/WeatherEffectComponent.js";
import { SkillTreeComponent } from "../game/components/SkillTreeComponent.js";

/**
 * Creates the player entity, including loading the model, setting up physics,
 * components, animations, and the controller.
 * @param {object} dependencies - Object containing required system instances.
 * @param {ResourceManager} dependencies.resourceManager
 * @param {PhysicsEngine} dependencies.physicsEngine
 * @param {SceneManager} dependencies.sceneManager
 * @param {AnimationSystem} dependencies.animationSystem
 * @param {InputManager} dependencies.inputManager
 * @param {UIManager} dependencies.uiManager
 * @returns {Promise<PlayerController|null>} A promise resolving with the created PlayerController or null on failure.
 */
export async function createPlayer(dependencies) {
  const {
    resourceManager,
    physicsEngine,
    sceneManager,
    animationSystem,
    inputManager,
    uiManager,
    soundManager,
  } = dependencies;

  // Ensure all dependencies are provided
  if (
    !resourceManager ||
    !physicsEngine ||
    !sceneManager ||
    !animationSystem ||
    !inputManager ||
    !uiManager
  ) {
    console.error("PlayerSetup: Missing required dependencies!");
    return null;
  }

  console.log("PlayerSetup: Creating player...");

  try {
    // 1. Calculate Spawn Position
    const spawnX = PLAYER_MODEL_CONFIG.position?.x ?? 0;
    const spawnZ = PLAYER_MODEL_CONFIG.position?.z ?? 0;
    const terrainHeightAtSpawn = physicsEngine.getHeightAt(spawnX, spawnZ);
    // Add a buffer to prevent spawning slightly underground if terrain height is exact
    const startHeightBuffer = 0.1;
    const playerStartY = (terrainHeightAtSpawn ?? 0) + startHeightBuffer;
    const initialPosition = { x: spawnX, y: playerStartY, z: spawnZ };
    console.log(
      `PlayerSetup: Spawn position calculated: X=${spawnX}, Y=${playerStartY.toFixed(
        3
      )}, Z=${spawnZ}`
    );

    // 2. Load Model
    const { gltf, model } = await resourceManager.loadModel(
      PLAYER_MODEL_CONFIG
    );
    sceneManager.add(model);
    resourceManager.normalizeModelScale(
      model,
      DEFAULT_MODEL_NORMALIZE_TARGET_HEIGHT
    );
    model.name = "Player"; // Assign a name

    // 3. Create Physics Body
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Calculate slightly smaller capsule dimensions based on visual size
    const capsuleRadius = Math.max(0.1, (Math.min(size.x, size.z) / 2) * 0.7); // 70% of narrowest horizontal extent
    const capsuleHeight = Math.max(0.2, size.y * 0.55); // 55% of visual height
    const physicsBodyCenterY = initialPosition.y + capsuleHeight / 2.0; // Position center correctly

    // Set initial visual position based on physics body center and calculated half-height
    // const halfH = playerBody.userData?.bodyHalfHeight || 0;
    // model.position.set(
    // initialPosition.x,
    // initialPosition.y - halfH,
    // initialPosition.z

    const bodyOptions = {
      shape: "capsule",
      radius: capsuleRadius,
      height: capsuleHeight,
      mass: 70, // Player mass
      position: {
        x: initialPosition.x,
        y: physicsBodyCenterY,
        z: initialPosition.z,
      },
      friction: 0.5, // Low friction for player capsule
      restitution: 0.0, // No bounce
      isPlayerCharacter: true, // Apply player-specific physics settings (e.g., angular factor)
      neverSleep: true, // Keep player physics active
      threeObject: model, // Link to visual model
      nodeId: "PLAYER",
      nodeName: "Player",
      instanceId: "PLAYER_INSTANCE", // Unique ID for the player entity
    };
    const playerBody = physicsEngine.createBody(bodyOptions);
    if (!playerBody) {
      throw new Error("PlayerSetup: Failed to create player physics body.");
    }
    model.userData.physicsBody = playerBody;

    // Adjust visual model position to align feet with physics body bottom
    const bodyHalfHeight =
      playerBody.userData?.bodyHalfHeight || capsuleHeight / 2.0; // Get actual half-height used by physics
    model.position.y = physicsBodyCenterY - bodyHalfHeight; // Set visual origin Y

    // 4. Attach Components
    const playerInstanceId = "PLAYER_INSTANCE"; // Consistent ID
    model.userData.isPlayer = true;
    model.userData.instanceId = playerInstanceId;
    // Create components, passing the instanceId to HealthComponent
    const healthComponent = new HealthComponent(
      100,
      playerInstanceId,
      model,
      uiManager
    );
    const statsComponent = new StatsComponent(
      {
        // Pass base stats from config
        speed: P_CONFIG.WALK_SPEED,
        runSpeed: P_CONFIG.RUN_SPEED,
        damage: P_CONFIG.ATTACK_DAMAGE,
        attackRange: P_CONFIG.ATTACK_RANGE,
        attackCooldown: P_CONFIG.ATTACK_COOLDOWN,
        health: P_CONFIG.HEALTH,
      },
      model,
      true // Pass isPlayer flag
    ); // Pass entityRef

    const inventoryComponent = new InventoryComponent(20);
    const abilityComponent = new AbilityComponent();

    // --- Create Equipment Component ---
    const equipmentComponent = new EquipmentComponent(
      inventoryComponent,
      statsComponent
    );

    // --- Create Skill Tree Component ---
    const skillTreeComponent = new SkillTreeComponent(
      statsComponent,
      abilityComponent
    );

    // Learn default abilities
    Object.values(ABILITIES).forEach((ability) =>
      abilityComponent.learnAbility(ability.id)
    );

    // --- Create WeatherEffectComponent ---
    const weatherEffectComponent = new WeatherEffectComponent(
      model, // Owner ref
      statsComponent, // Stats ref
      healthComponent, // Health ref
      uiManager // UI ref (optional)
    );
    console.log("WeatherEffectComponent created for Player.");
    // --- End Create WeatherEffectComponent ---

    // Assign components to model userData (primary storage)
    model.userData.health = healthComponent;
    model.userData.stats = statsComponent;
    model.userData.inventory = inventoryComponent;
    model.userData.abilityComponent = abilityComponent;
    model.userData.equipment = equipmentComponent;
    model.userData.weatherEffect = weatherEffectComponent;
    model.userData.skillTree = skillTreeComponent;

    // Link components to physics body userData if needed by systems accessing physics directly
    playerBody.userData.healthComponent = healthComponent;
    playerBody.userData.stats = statsComponent;
    playerBody.userData.abilityComponent = abilityComponent;
    playerBody.userData.instanceId = playerInstanceId; // Ensure body also has ID
    playerBody.userData.equipment = equipmentComponent;
    playerBody.userData.skillTree = skillTreeComponent;

    // 5. Setup Animation FSM
    let modelAnimations = null;
    if (gltf.animations?.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      gltf.animations.forEach((c) => {
        actions[c.name] = mixer.clipAction(c);
      });
      modelAnimations = { mixer, actions };
      animationSystem.registerMixer(mixer);
      // FSM will be created inside PlayerController using these actions
    } else {
      console.warn("PlayerSetup: Player model has no animations.");
    }

    // // --- ***** 6. Add Torch Light ***** ---
    // console.log("PlayerSetup: Adding torch light...");
    // const torchColor = 0xffa55a; // Warm orange/yellow
    // const torchIntensity = 250; // Adjust intensity (SpotLight intensity needs higher values)
    // const torchDistance = 15; // How far the light reaches
    // const torchAngle = Math.PI / 6; // Cone angle (30 degrees)
    // const torchPenumbra = 0.3; // Soft edge
    // const torchDecay = 2; // Realistic falloff

    // const torchLight = new THREE.SpotLight(
    //   torchColor,
    //   torchIntensity,
    //   torchDistance,
    //   torchAngle,
    //   torchPenumbra,
    //   torchDecay
    // );

    // // --- Torch Position (Relative to Player Model) ---
    // // Position it slightly in front, up, and maybe to the side
    // // Adjust these values based on your model's size and desired look
    // torchLight.position.set(0.4, 1.2, 0.6); // Right shoulder height, slightly forward

    // // --- Torch Target (Direction) ---
    // // The target determines where the spotlight points.
    // // Add it as a child of the model too, positioned further in front.
    // const torchTarget = new THREE.Object3D();
    // // Position target relative to the model's origin (0,0,0 in local space)
    // // Point it slightly downwards from the torch's height
    // torchTarget.position.set(0, 0.8, 5); // Points forward and slightly down

    // // --- Attach to Player Model ---
    // model.add(torchLight); // Add light as child of player model
    // model.add(torchTarget); // Add target as child of player model
    // torchLight.target = torchTarget; // Tell the light to point at the target object

    // // --- Configure Shadows (Optional but recommended for realism) ---
    // torchLight.castShadow = true;
    // // Adjust shadow map size and bias carefully for performance vs quality
    // torchLight.shadow.mapSize.width = 512; // Lower resolution than sun usually okay
    // torchLight.shadow.mapSize.height = 512;
    // torchLight.shadow.camera.near = 0.5;
    // torchLight.shadow.camera.far = torchDistance; // Match light distance
    // torchLight.shadow.bias = -0.005; // Adjust bias to prevent shadow acne

    // // --- Store Reference & Initial State ---
    // // Store reference for easy access later (e.g., toggling visibility)
    // model.userData.torchLight = torchLight;
    // torchLight.visible = false; // Start with torch OFF
    // console.log("PlayerSetup: Torch light added and initially hidden.");
    // // --- ***** END Add Torch Light ***** ---

    // 6. Create PlayerController
    const playerController = new PlayerController(
      model,
      sceneManager.getCamera(),
      inputManager,
      modelAnimations, // Pass mixer & actions object
      playerBody,
      physicsEngine,
      null, // instancedManager ref (player likely doesn't need it)
      sceneManager, // Pass sceneManager if needed by controller
      uiManager,
      soundManager
    );

    console.log("PlayerSetup: Player created successfully.");
    return {
      playerController: playerController,
      spawnPosition: initialPosition,
    };
  } catch (error) {
    console.error("PlayerSetup: Error during player creation:", error);
    // Clean up potentially added model?
    // if (model && sceneManager) sceneManager.remove(model);
    return null; // Indicate failure
  }
}

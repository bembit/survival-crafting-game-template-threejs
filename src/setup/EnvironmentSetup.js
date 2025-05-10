// src/setup/EnvironmentSetup.js
import * as THREE from "three";
import {
  STATIC_MODEL_CONFIGS,
  ENV_MODEL_CONFIGS,
} from "../config/ModelConfig.js";
// Import components only if static assets might need them (e.g., an interactable chest)
// import { InteractableComponent } from "../game/components/InteractableComponent.js";
// import { HealthComponent } from "../game/components/HealthComponent.js";
// import { HealthComponent } from "./game/components/HealthComponent.js"; // <<< Import
// import { StatsComponent } from "./game/components/StatsComponent.js"; // <<< Import
// import { InventoryComponent } from "./game/components/InventoryComponent.js"; // <<< Import
// import { PLAYER_CONFIG as P_CONFIG } from "./config/PlayerConfig.js"; // Use alias if needed
// import { AbilityComponent } from "./game/components/AbilityComponent.js"; // <<< Import
// import { ABILITIES } from "./config/AbilityConfig.js"; // <<< Import ability definitions
/**
 * Loads and configures static/environment models defined in ModelConfig.js.
 * Places them on the terrain and sets up physics/animation if specified.
 * @param {object} dependencies - Object containing required system instances.
 * @param {ResourceManager} dependencies.resourceManager
 * @param {PhysicsEngine} dependencies.physicsEngine
 * @param {SceneManager} dependencies.sceneManager
 * @param {AnimationSystem} dependencies.animationSystem
 * @param {InteractionSystem} [dependencies.interactionSystem] - Optional, if static assets can be interacted with.
 */
export async function loadStaticAssets(dependencies) {
  const {
    resourceManager,
    physicsEngine,
    sceneManager,
    animationSystem,
    interactionSystem, // Optional dependency
  } = dependencies;

  if (!resourceManager || !physicsEngine || !sceneManager || !animationSystem) {
    console.error("EnvironmentSetup: Missing required dependencies!");
    return;
  }

  console.log("EnvironmentSetup: Loading static/environment assets...");
  const loadPromises = [];
  // Combine both configuration arrays
  const allStaticConfigs = [...STATIC_MODEL_CONFIGS, ...ENV_MODEL_CONFIGS];

  allStaticConfigs.forEach((config) => {
    // Create a promise for each model loading and setup process
    const modelPromise = resourceManager
      .loadModel(config)
      .then(async ({ gltf, model }) => {
        // Make inner function async for potential awaits
        sceneManager.add(model); // Add visual model to the scene

        // Optional normalization (define target height if used)
        // if (config.normalize) {
        //     resourceManager.normalizeModelScale(model, SOME_TARGET_HEIGHT);
        // }

        let physicsBody = null;
        const modelX = model.position.x; // Position set by ResourceManager from config
        const modelZ = model.position.z;
        const modelInitialY = model.position.y; // Original Y

        // --- Physics Setup ---
        if (config.needsPhysics || config.isInteractable) {
          try {
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);

            // Calculate physics shape dimensions
            const hx = Math.max(
              0.01,
              (size.x / 2) * (config.physicsScaleX || 1)
            );
            const hy = Math.max(
              0.01,
              (size.y / 2) * (config.physicsScaleY || 1)
            ); // Box half-height
            const hz = Math.max(
              0.01,
              (size.z / 2) * (config.physicsScaleZ || 1)
            );

            // Calculate physics body position (centered on terrain height + half-height)
            const terrainY = physicsEngine.getHeightAt(modelX, modelZ);
            const physicsBodyY = (terrainY ?? modelInitialY) + hy;

            const bodyOptions = {
              shape: config.physicsShape || "box", // Default to box
              hx: hx,
              hy: hy,
              hz: hz,
              // Add radius/height if shape is sphere/capsule based on config
              radius: config.physicsRadius,
              height: config.physicsHeight,
              mass: 0, // Static assets usually have mass 0
              position: { x: modelX, y: physicsBodyY, z: modelZ },
              quaternion: {
                x: model.quaternion.x,
                y: model.quaternion.y,
                z: model.quaternion.z,
                w: model.quaternion.w,
              },
              friction: config.friction ?? 0.8,
              restitution: config.restitution ?? 0.1,
              threeObject: model,
              nodeId: config.id || config.path, // Unique ID for the body
              nodeName: config.name || config.path, // Name for debugging/UI
              // Pass flags/data for component creation if needed
              // IDEA: If a static chest is interactable
              // interactionType: config.isInteractable ? (config.interactionType || 'static_object') : null,
              // initialHealth: config.initialHealth, // If a static object can be damaged
            };
            physicsBody = physicsEngine.createBody(bodyOptions);

            if (physicsBody) {
              model.userData.physicsBody = physicsBody;
              // --- Attach Components if needed ---
              // IDEA: A static, interactable shrine
              // if (config.interactionType === 'shrine') {
              //    physicsBody.userData.interactableComponent = new InteractableComponent('shrine');
              //    // Link back to model if necessary
              //    model.userData.interactableComponent = physicsBody.userData.interactableComponent;
              // }
            } else {
              console.error(
                `EnvironmentSetup: Physics body creation failed for ${config.path}`
              );
            }

            // Adjust VISUAL model Y position to sit ON the terrain height
            model.position.y = terrainY ?? modelInitialY;
          } catch (error) {
            console.error(
              `EnvironmentSetup: Error processing physics for ${config.path}:`,
              error
            );
          }
        } else {
          // No physics needed, just place visually on terrain
          const terrainY = physicsEngine.getHeightAt(modelX, modelZ);
          if (terrainY !== null) {
            model.position.y = terrainY;
          }
        }

        // --- Animation Setup (if applicable) ---
        if (gltf.animations?.length > 0 && animationSystem) {
          try {
            const mixer = new THREE.AnimationMixer(model);
            // Play the first animation by default, or use config to specify
            const clipToPlay =
              config.defaultAnimation || gltf.animations[0]?.name;
            if (clipToPlay) {
              const clipAction = mixer.clipAction(
                gltf.animations.find((a) => a.name === clipToPlay)
              );
              if (clipAction) {
                clipAction.play();
                animationSystem.registerMixer(mixer);
              } else {
                console.warn(
                  `Animation clip "${clipToPlay}" not found for ${config.path}`
                );
              }
            }
          } catch (animError) {
            console.error(
              `EnvironmentSetup: Error setting up animation for ${config.path}:`,
              animError
            );
          }
        }
      })
      .catch((error) => {
        // Catch errors during model loading itself
        console.error(
          `EnvironmentSetup: Failed loading model (${config.path}):`,
          error
        );
        // Resolve the promise even on error so Promise.all doesn't fail completely
        // return null; // Or handle differently
      });

    loadPromises.push(modelPromise);
  }); // End forEach config

  // Wait for all loading and setup promises to settle
  await Promise.all(loadPromises);
  console.log(
    "EnvironmentSetup: Finished processing static/environment assets."
  );
}

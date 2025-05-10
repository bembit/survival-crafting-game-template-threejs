// src/core/ResourceManager.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js"; // SkeletonUtils for proper skinned mesh cloning

/**
 * Manages loading and caching game assets like 3D models.
 * Handles asynchronous loading using Promises and provides basic utilities.
 * Future improvements: Loading other asset types (textures, audio).
 */
export class ResourceManager {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    /** @type {Map<string, {gltf: object, originalModel: THREE.Object3D}>} */
    this.cache = new Map(); // Initialize cache
    // TODO: Add loaders for other types (TextureLoader, AudioLoader)
    console.log("ResourceManager initialized");
  }

  /**
   * Loads a GLTF/GLB model asynchronously, utilizing a cache.
   * Returns a Promise resolving with the GLTF data and a CLONE of the model scene.
   * Applies initial transformations and shadow settings based on config to the original load.
   * @param {object} config - Configuration object for the model.
   * @param {string} config.path - The URL path to the GLTF/GLB file (used as cache key).
   * @param {object} [config.position] - Optional initial position {x, y, z}.
   * @param {number} [config.scale] - Optional initial uniform scale factor.
   * @param {object} [config.rotation] - Optional initial rotation {x, y, z} in radians.
   * @returns {Promise<{gltf: object, model: THREE.Object3D}>} A promise that resolves with the loaded gltf data and a CLONE of the model's scene object, or rejects with an error.
   */
  loadModel(config) {
    const cacheKey = config.path;

    // REVISIT
    // --- Check Cache ---
    if (this.cache.has(cacheKey)) {
      console.log(`Cache hit for: ${cacheKey}`);
      const cachedData = this.cache.get(cacheKey);
      // Clone the model using SkeletonUtils if it might be animated/skinned
      // Use regular clone otherwise, but SkeletonUtils handles more cases.
      const clonedModel = SkeletonUtils.clone(cachedData.originalModel);

      // Apply config transforms TO THE CLONE if needed (or assume they are set later)
      // For simplicity, let's assume transforms are set after getting the model instance.
      // If initial config needed applying here:
      // if (config.position) clonedModel.position.set(config.position.x, config.position.y, config.position.z);
      // if (config.scale) clonedModel.scale.set(config.scale, config.scale, config.scale); // Careful with overlapping scale
      // if (config.rotation) clonedModel.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);

      // Return the original GLTF data but the *cloned* model scene
      return Promise.resolve({ gltf: cachedData.gltf, model: clonedModel });
    }

    // --- Load if not in Cache ---
    console.log(`Loading model: ${cacheKey}`);
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        config.path,
        // --- Success Callback (onLoad) ---
        (gltf) => {
          const originalModel = gltf.scene; // The Object3D directly from loader

          // Apply initial transformations from config TO THE ORIGINAL MODEL (stored in cache)
          if (config.position) {
            originalModel.position.set(
              config.position.x,
              config.position.y,
              config.position.z
            );
          }
          if (config.scale) {
            originalModel.scale.set(config.scale, config.scale, config.scale);
          }
          if (config.rotation) {
            originalModel.rotation.set(
              config.rotation.x,
              config.rotation.y,
              config.rotation.z
            );
          }

          // Apply default shadow settings TO THE ORIGINAL MODEL
          originalModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // --- Store original in Cache ---
          const cacheData = { gltf, originalModel }; // Store original model here
          this.cache.set(cacheKey, cacheData);

          // --- Resolve with a CLONE for the first requester ---
          // Use SkeletonUtils for cloning to handle skinned meshes correctly
          const initialClonedModel = SkeletonUtils.clone(originalModel);

          console.log(`Model loaded and cached: ${cacheKey}`);
          resolve({ gltf, model: initialClonedModel }); // Resolve promise with GLTF data and the first clone
        },
        undefined, // Progress callback unused
        // --- Error Callback (onError) ---
        (error) => {
          console.error(`Error loading model (${config.path}):`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Normalizes the scale of a model based on its bounding box to achieve a target height.
   * IMPORTANT: This modifies the scale of the provided model instance directly.
   * Call this after getting the model instance from loadModel().
   * @param {THREE.Object3D} model - The model instance to normalize.
   * @param {number} targetHeight - The desired maximum dimension (usually height).
   */
  normalizeModelScale(model, targetHeight) {
    if (!model || targetHeight <= 0) return;
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension === 0) {
      console.warn("Cannot normalize model with zero size.");
      return;
    }
    // Calculate scale factor based on the model's CURRENT scale
    const currentScale = model.scale.x; // Assuming uniform scale
    const scaleFactor = targetHeight / maxDimension; // Target scale relative to size=1

    // We need to set the final absolute scale, not relative to current one here if goal is targetHeight
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    // console.log(`Model normalized to target height ${targetHeight.toFixed(2)} with final scale ${scaleFactor.toFixed(3)}`);
  }
}

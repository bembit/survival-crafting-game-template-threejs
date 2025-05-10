// src/world/InstancedManager.js
import * as THREE from "three";
import { mulberry32, cyrb128 } from "../utils/PRNG.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Manages the creation and placement of large numbers of identical meshes
 * using THREE.InstancedMesh for performance. Handles models with multiple parts.
 */
export class InstancedManager {
  /** @type {import('./SceneManager.js').SceneManager} */
  sceneManager;
  /** @type {import('../physics/PhysicsEngine.js').PhysicsEngine} */
  physicsEngine;
  /** @type {import('../core/ResourceManager.js').ResourceManager} */
  resourceManager;

  /** @type {Array<THREE.InstancedMesh>} */
  instancedMeshes;
  /** @type {Array<Ammo.btRigidBody>} */
  instancePhysicsBodies;
  /** @type {Map<string, {mesh: THREE.InstancedMesh, type: string}>} */
  instancedMeshGroups;
  /** @type {Map<Ammo.btRigidBody, {meshIds: string[], instanceIndex: number}>} */
  bodyToInstanceMap;

  // Reusable THREE objects
  matrix = new THREE.Matrix4();
  position = new THREE.Vector3();
  quaternion = new THREE.Quaternion();
  scale = new THREE.Vector3();

  _upVector = new THREE.Vector3(0, 1, 0);
  _alignQuaternion = new THREE.Quaternion();
  _tempMatrix = new THREE.Matrix4();

  constructor(sceneManager, physicsEngine, resourceManager) {
    this.sceneManager = sceneManager;
    this.physicsEngine = physicsEngine;
    this.resourceManager = resourceManager;

    this.instancedMeshes = [];
    this.instancePhysicsBodies = [];
    this.instancedMeshGroups = new Map();
    this.bodyToInstanceMap = new Map();

    console.log("InstancedManager initialized.");
  }

  _selectModelVariant(variants, randomFn) {
    if (!variants || variants.length === 0) return null;

    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    if (totalWeight <= 0) return variants[0]?.path || null;

    let randomValue = randomFn() * totalWeight;
    for (const variant of variants) {
      const weight = Number(variant.weight) || 0;
      if (randomValue < weight) {
        return variant.path;
      }
      randomValue -= weight;
    }
    return variants[variants.length - 1]?.path || null;
  }

  /**
   * Creates and places multiple instances based on a node configuration.
   * Handles models with multiple parts. Physics now created inside loop.
   * @param {object} config - Configuration object for the node type.
   * @param {string} environmentSeed - The seed for deterministic placement.
   * @param {Set<string>} [skipInstanceIds=new Set()] - Optional set of instance IDs to skip creating physics for (used on load).
   */
  async createNodes(config, environmentSeed, skipInstanceIds = new Set()) {
    const {
      id = "unknown_node",
      count = 50,
      modelPath,
      modelVariants,
      createPhysics,
      physicsShape,
      baseTrunkHeight,
      baseWidth,
      baseRadius,
      physicsScale = 1.0, // : Default physics scale (or get from config)
      alignToNormal = false,
    } = config;

    const numericSeed = cyrb128(String(environmentSeed + id));
    const random = mulberry32(numericSeed);

    console.log(
      `Creating ${count} nodes for ${id}. Variants: ${!!modelVariants}, Align: ${alignToNormal}. Skipping ${
        skipInstanceIds.size
      } depleted.`
    );

    let effectiveModelPath = modelPath;
    let useVariantsPerInstance = false;

    if (!effectiveModelPath && modelVariants?.length > 0) {
      effectiveModelPath = this._selectModelVariant(modelVariants, random);
      useVariantsPerInstance = true;
      console.log(
        `-> Using selected variant path for initial loading: ${effectiveModelPath}`
      );
      if (!effectiveModelPath) {
        console.error(
          `InstancedManager: Could not select a valid initial model variant for ${id}.`
        );
        return;
      }
    } else if (modelVariants?.length > 0) {
      useVariantsPerInstance = true;
      console.log(
        `-> Using single modelPath ${modelPath} for loading, but will select variants per instance.`
      );
    } else if (!effectiveModelPath && !modelVariants) {
      console.error(
        `InstancedManager: No modelPath or modelVariants provided for ${id}.`
      );
      return;
    }

    // --- Config Validation ---
    let effectiveCreatePhysics = createPhysics;
    if (effectiveCreatePhysics && !physicsShape) {
      console.warn(
        `InstancedManager: Physics requested for ${id} but no physicsShape defined. Skipping physics.`
      );
      effectiveCreatePhysics = false;
    } else if (effectiveCreatePhysics) {
      if (
        (physicsShape === "cylinder" || physicsShape === "capsule") &&
        (baseTrunkHeight === undefined || baseWidth === undefined)
      ) {
        console.error(
          `InstancedManager: Physics for ${id} requires 'baseTrunkHeight' and 'baseWidth' in config for shape ${physicsShape}. Skipping physics.`
        );
        effectiveCreatePhysics = false;
      } else if (
        (physicsShape === "sphere" || physicsShape === "box") &&
        baseRadius === undefined
      ) {
        console.error(
          `InstancedManager: Physics for ${id} requires 'baseRadius' in config for shape ${physicsShape}. Skipping physics.`
        );
        effectiveCreatePhysics = false;
      }
    }
    // --- End Validation ---

    try {
      let loadedModelContainer;
      let loadedGltf;
      try {
        console.log(
          `InstancedManager: Loading model ${effectiveModelPath} for ${id}...`
        );
        const result = await this.resourceManager.loadModel({
          path: effectiveModelPath,
        });
        loadedModelContainer = SkeletonUtils.clone(result.model);
        loadedGltf = result.gltf;
      } catch (loadError) {
        console.error(
          `InstancedManager: Failed to load model ${effectiveModelPath} for ${id}:`,
          loadError
        );
        return;
      }

      const parts = {};
      loadedModelContainer.traverse((child) => {
        if (child.isMesh) {
          let partName = child.name || child.material?.name || "Main";
          if (
            partName.toLowerCase().includes("trunk") ||
            partName.toLowerCase().includes("stem")
          ) {
            partName = "Trunks";
          } else if (
            partName.toLowerCase().includes("leaves") ||
            partName.toLowerCase().includes("foliage")
          ) {
            partName = "Leaves";
          } else if (
            partName.toLowerCase().includes("rock") ||
            partName.toLowerCase().includes("stone") ||
            partName.toLowerCase().includes("ore")
          ) {
            partName = "Main";
          } else if (id.includes("grass")) {
            partName = "Main";
          }
          if (!parts[partName]) {
            parts[partName] = {
              geometry: child.geometry,
              material: child.material,
            };
            console.log(
              `InstancedManager: Extracted part '${partName}' for ${id}.`
            );
          }
        }
      });
      if (Object.keys(parts).length === 0)
        throw new Error(`No Meshes found in ${effectiveModelPath}`);
      if (Object.keys(parts).length === 1 && !parts["Main"]) {
        const firstKey = Object.keys(parts)[0];
        parts["Main"] = parts[firstKey];
        delete parts[firstKey];
      }

      const currentInstancedMeshes = {};
      const meshIdsCreated = [];
      for (const partName in parts) {
        const part = parts[partName];
        if (!part?.geometry || !part?.material) continue;
        const meshId = `${id}_${partName}`;
        meshIdsCreated.push(meshId);
        let instancedMesh;
        if (this.instancedMeshGroups.has(meshId)) {
          instancedMesh = this.instancedMeshGroups.get(meshId).mesh;
        } else {
          instancedMesh = new THREE.InstancedMesh(
            part.geometry,
            part.material,
            count
          );
          instancedMesh.castShadow = !id.includes("grass");
          instancedMesh.receiveShadow = !id.includes("grass");
          instancedMesh.name = meshId;
          this.instancedMeshGroups.set(meshId, {
            mesh: instancedMesh,
            type: id,
          });
          this.sceneManager.add(instancedMesh);
          console.log(
            `InstancedManager: Created new InstancedMesh for ${meshId}.`
          );
        }
        currentInstancedMeshes[partName] = instancedMesh;
      }

      const zeroScaleMatrix = new THREE.Matrix4()
        .identity()
        .scale(new THREE.Vector3(0, 0, 0));
      let placedCount = 0;
      const halfArea = (config.areaSize || 100) / 2;

      // ======================== PLACEMENT LOOP START ========================
      for (let i = 0; i < count; i++) {
        let instanceModelPath = effectiveModelPath;
        if (useVariantsPerInstance && modelVariants?.length > 0) {
          instanceModelPath = this._selectModelVariant(modelVariants, random);
          if (!instanceModelPath) {
            console.warn(
              `Could not select variant for instance ${i} of ${id}, using default.`
            );
            instanceModelPath = effectiveModelPath;
          }
        }

        const x = random() * (config.areaSize || 100) - halfArea;
        const z = random() * (config.areaSize || 100) - halfArea;
        const terrainY = this.physicsEngine.getHeightAt(x, z);
        if (terrainY === null) {
          console.warn(
            `Skipping instance ${i} of ${id}: No terrain height found at (${x.toFixed(
              1
            )}, ${z.toFixed(1)})`
          );
          continue;
        }

        const instanceId = `${config.id}_${i}`;
        const shouldSkip = skipInstanceIds.has(instanceId);

        const scaleVariance = config.scaleVariance ?? 0.3;
        const scaleFactor = 1.0 + (random() - 0.5) * 2.0 * scaleVariance; // <<< Instance-specific scale factor

        this.scale.set(scaleFactor, scaleFactor, scaleFactor);
        this.position.set(x, terrainY, z);

        let instanceQuaternion = new THREE.Quaternion().setFromAxisAngle(
          this._upVector,
          random() * Math.PI * 2
        );

        // Apply Matrix for EACH PART
        for (const partName in currentInstancedMeshes) {
          const instancedMesh = currentInstancedMeshes[partName];
          if (!instancedMesh) continue;

          let finalMatrix = this.matrix;
          let partPositionOffset = new THREE.Vector3(0, 0, 0);
          if (partName === "Leaves" && id.includes("tree")) {
            const originalTrunkHeight = baseTrunkHeight || 3; // Use ORIGINAL height for offset basis
            partPositionOffset.y = originalTrunkHeight;
          }

          if (shouldSkip) {
            finalMatrix = zeroScaleMatrix;
          } else {
            const finalPosition = this.position
              .clone()
              .add(
                partPositionOffset
                  .clone()
                  .applyQuaternion(instanceQuaternion)
                  .multiplyScalar(scaleFactor)
              );
            finalMatrix.compose(finalPosition, instanceQuaternion, this.scale);
          }

          // NaN Check (Safety)
          if (finalMatrix.elements.some(isNaN)) {
            console.error(
              `NaN detected in matrix for instance ${i} of ${id}, part ${partName}. Skipping matrix update.`
            );
            instancedMesh.setMatrixAt(i, zeroScaleMatrix);
          } else {
            instancedMesh.setMatrixAt(i, finalMatrix);
          }
        }

        // ************************ PHYSICS CREATION (MOVED INSIDE LOOP) ************************
        if (effectiveCreatePhysics && !shouldSkip) {
          let physicsHeight = 0,
            physicsRadius = 0,
            physicsBodyY = 0;
          const effectivePhysicsScale = physicsScale ?? 1.0; // Use default if not provided

          // Calculate SCALED physics dimensions
          if (physicsShape === "cylinder" || physicsShape === "capsule") {
            const originalHeight = baseTrunkHeight || 3;
            const originalRadius = (baseWidth || 0.6) / 2.0;
            physicsHeight =
              originalHeight * scaleFactor * effectivePhysicsScale;
            physicsRadius =
              originalRadius * scaleFactor * effectivePhysicsScale;
            physicsBodyY = terrainY - 1.0 + physicsHeight / 2.0; // Center Y = Ground + Half (Scaled) Height
          } else if (physicsShape === "sphere" || physicsShape === "box") {
            const originalRadius = baseRadius || 0.8;
            physicsRadius =
              originalRadius * scaleFactor * effectivePhysicsScale;
            physicsHeight = physicsRadius * 2.0; // Approximate height for sphere/box is based on scaled radius
            physicsBodyY = terrainY + physicsRadius; // Center Y for sphere/box uses scaled radius
          } else {
            console.warn(
              `InstancedManager: Cannot create physics for ${id}: Unknown physicsShape '${physicsShape}' or missing dimensions.`
            );
            continue; // Skip physics for this instance
          }

          // Create Physics Body Options
          let bodyOptions = {
            mass: 0,
            position: { x: x, y: physicsBodyY, z: z },
            quaternion: {
              x: instanceQuaternion.x,
              y: instanceQuaternion.y,
              z: instanceQuaternion.z,
              w: instanceQuaternion.w,
            },
            instanceId: instanceId,
            nodeId: config.id,
            nodeName: config.name,
            initialHealth: config.initialHealth,
            interactionType: config.interactionType,
            resourceId: config.resourceId,
            resourceQty: config.resourceQty,
            friction: config.friction ?? 0.8,
            restitution: config.restitution ?? 0.2,
          };

          // Add shape-specific parameters using SCALED dimensions
          if (physicsShape === "cylinder" || physicsShape === "capsule") {
            bodyOptions.shape = "capsule"; // Prefer capsule
            bodyOptions.radius = physicsRadius;
            // Calculate scaled cylinder part height for Ammo capsule
            const originalCylinderPartHeight =
              (baseTrunkHeight || 3) - 2 * ((baseWidth || 0.6) / 2.0);
            bodyOptions.height =
              originalCylinderPartHeight * scaleFactor * effectivePhysicsScale;
            if (bodyOptions.height < 0) bodyOptions.height = 0;
          } else if (physicsShape === "sphere") {
            bodyOptions.shape = "sphere";
            bodyOptions.radius = physicsRadius;
          } else if (physicsShape === "box") {
            bodyOptions.shape = "box";
            bodyOptions.hx = physicsRadius; // Assuming box based on SCALED radius
            bodyOptions.hy = physicsHeight / 2.0; // physicsHeight is already scaled
            bodyOptions.hz = physicsRadius;
          } else {
            bodyOptions = null;
          }

          if (bodyOptions) {
            const body = this.physicsEngine.createBody(bodyOptions);
            if (body) {
              this.instancePhysicsBodies.push(body);
              body.userData = body.userData || {};
              body.userData.meshIds = meshIdsCreated;
              this.bodyToInstanceMap.set(body, {
                meshIds: meshIdsCreated,
                instanceIndex: i,
              });
            } else {
              console.error(
                `Failed to create physics body for instance ${i} of ${id}`
              );
            }
          }
        } // End physics block
        // ************************ END PHYSICS CREATION ************************

        placedCount++;
      } // ======================== END PLACEMENT LOOP ========================

      // Mark matrices for update for all created parts
      for (const partName in currentInstancedMeshes) {
        currentInstancedMeshes[partName].instanceMatrix.needsUpdate = true;
      }

      console.log(
        `Placed ${placedCount}/${count} nodes of type ${id}. Applied depletion state for ${skipInstanceIds.size} nodes.`
      );
    } catch (error) {
      console.error(
        `Failed to create instanced nodes for ${id} using model ${effectiveModelPath}:`,
        error
      );
    }
  } // End createNodes

  hideInstance(body) {
    if (!this.bodyToInstanceMap.has(body)) {
      console.warn("hideInstance: Body not found in map.");
      return;
    }
    const { meshIds, instanceIndex } = this.bodyToInstanceMap.get(body);
    if (instanceIndex === undefined || !meshIds || meshIds.length === 0) {
      console.warn(`hideInstance: Invalid data for body:`, {
        meshIds,
        instanceIndex,
      });
      return;
    }
    console.log(`Hiding instance ${instanceIndex} for mesh IDs:`, meshIds);
    const zeroScaleMatrix = new THREE.Matrix4()
      .identity()
      .scale(new THREE.Vector3(0, 0, 0));
    meshIds.forEach((meshId) => {
      const groupInfo = this.instancedMeshGroups.get(meshId);
      if (groupInfo?.mesh) {
        if (instanceIndex >= 0 && instanceIndex < groupInfo.mesh.count) {
          groupInfo.mesh.setMatrixAt(instanceIndex, zeroScaleMatrix);
          groupInfo.mesh.instanceMatrix.needsUpdate = true;
        } else {
          console.error(
            `hideInstance: instanceIndex ${instanceIndex} out of bounds for mesh ${meshId} (count: ${groupInfo.mesh.count})`
          );
        }
      } else {
        console.warn(
          `hideInstance: Could not find InstancedMesh for ID ${meshId}`
        );
      }
    });
  }

  destroy() {
    console.log("Destroying InstancedManager...");
    this.instancedMeshGroups.forEach((groupInfo) => {
      const m = groupInfo.mesh;
      if (this.sceneManager && m) {
        this.sceneManager.remove(m);
      }
      // Safer not to dispose geometry/material here
    });
    this.instancePhysicsBodies.forEach((b) => {
      if (this.physicsEngine) {
        this.physicsEngine.removeBody(b);
      }
    });
    this.instancedMeshes = [];
    this.instancePhysicsBodies = [];
    this.instancedMeshGroups.clear();
    this.bodyToInstanceMap.clear();
    console.log("InstancedManager destroyed.");
  }
} // End Class

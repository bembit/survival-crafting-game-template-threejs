// src/game/physics/PhysicsEngine.js
import * as THREE from "three";
// Shared wireframe material for debug shapes
import { debugMaterial } from "../config/MaterialConfig.js";

import { HealthComponent } from "../game/components/HealthComponent.js";
import { InteractableComponent } from "../game/components/InteractableComponent.js";
import { ResourceNodeComponent } from "../game/components/ResourceNodeComponent.js";
import { StatsComponent } from "../game/components/StatsComponent.js";

/**
 * Wrapper class for the Ammo.js physics engine.
 * Provides an interface for creating bodies, stepping the world, handling collisions (stubbed),
 * and visualizing physics shapes for debugging.
 */
export class PhysicsEngine {
  constructor() {
    if (typeof Ammo === "undefined") {
      throw new Error(
        "PhysicsEngine requires Ammo.js to be loaded before instantiation."
      );
    }
    // Ammo.js world components
    /** @type {Ammo.btDiscreteDynamicsWorld | null} */
    this.physicsWorld = null;
    /** @type {Ammo.btDefaultCollisionConfiguration | null} */
    this.collisionConfiguration = null;
    /** @type {Ammo.btCollisionDispatcher | null} */
    this.dispatcher = null;
    /** @type {Ammo.btDbvtBroadphase | null} */
    this.broadphase = null;
    /** @type {Ammo.btSequentialImpulseConstraintSolver | null} */
    this.solver = null;

    // Reusable temporary Ammo objects for transformations
    /** @type {Ammo.btTransform} */
    this.tempTransform = new Ammo.btTransform();
    /** @type {Ammo.btVector3} */
    this.tempVec3 = new Ammo.btVector3(0, 0, 0);
    /** @type {Ammo.btQuaternion} */
    this.tempQuat = new Ammo.btQuaternion(0, 0, 0, 1);

    // Tracking dynamic bodies for efficient visual sync
    /** @type {Array<Ammo.btRigidBody>} */
    this.dynamicBodies = [];

    // --- Debug Visualization ---
    /** @type {THREE.Group} Group to hold all debug wireframe meshes. */
    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = false; // Start visible by default
    /** @type {THREE.Scene | null} Reference to the main THREE.js scene. */
    this.sceneRef = null; // Set via setSceneReference

    // Initialize the Ammo world
    this._initWorld();
    console.log("PhysicsEngine initialized with Ammo.js");
  }

  /**
   * Provides a reference to the main THREE.js scene for adding debug visuals.
   * Automatically adds the debug group to the scene.
   * @param {THREE.Scene} scene - The main THREE.js scene instance.
   */
  setSceneReference(scene) {
    if (!scene) {
      console.error("PhysicsEngine: Invalid scene reference provided.");
      return;
    }
    this.sceneRef = scene;
    // Ensure the debug group is added to the provided scene
    if (!this.debugGroup.parent) {
      scene.add(this.debugGroup);
      console.log("Physics debug group added to scene.");
    }
  }

  /** Initializes the internal Ammo.js physics world and components. */
  _initWorld() {
    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(
      this.collisionConfiguration
    );
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfiguration
    );
    // Set gravity (make this configurable externally later if needed)
    this.physicsWorld.setGravity(new Ammo.btVector3(0, -19.6, 0));
    // this.physicsWorld.setGravity(new Ammo.btVector3(0, -200, 0));
    console.log("Ammo.js physics world created.");
  }

  /**
   * Creates an Ammo.js rigid body and corresponding debug visual, adding them to the world/scene.
   * @param {object} options - Configuration for the body.
   * @param {string} options.shape - 'box', 'sphere', 'capsule', 'plane'.
   * @param {number} [options.mass=0] - Mass (0 = static).
   * @param {object} [options.position={x:0,y:0,z:0}] - Initial position {x, y, z}.
   * @param {object} [options.quaternion={x:0,y:0,z:0,w:1}] - Initial rotation {x, y, z, w}.
   * @param {number} [options.hx] - Half-extent X (for box).
   * @param {number} [options.hy] - Half-extent Y (for box).
   * @param {number} [options.hz] - Half-extent Z (for box).
   * @param {number} [options.radius] - Radius (for sphere, capsule).
   * @param {number} [options.height] - Total height (for capsule).
   * @param {number} [options.friction=0.5] - Friction coefficient.
   * @param {number} [options.restitution=0.1] - Bounciness.
   * @param {boolean} [options.isPlayerCharacter=false] - Flag to apply player-specific settings (e.g., angularFactor).
   * @param {boolean} [options.neverSleep=false] - Prevent body from sleeping.
   * @param {THREE.Object3D} [options.threeObject=null] - The associated THREE.js visual mesh/group.
   * @returns {Ammo.btRigidBody | null} The created Ammo rigid body, or null on error.
   */
  createBody(options) {
    if (!this.physicsWorld) {
      console.error("Cannot create body: Physics world not initialized.");
      return null;
    }

    const {
      shape,
      mass = 0,
      position = { x: 0, y: 0, z: 0 },
      quaternion = { x: 0, y: 0, z: 0, w: 1 },
      friction = 0.5,
      restitution = 0.1,
      isPlayerCharacter = false,
      neverSleep = false,
      threeObject = null,
    } = options;
    let collisionShape;
    let debugMesh = null;
    let effectiveHalfHeight = 0;

    // --- Create Collision Shape and Debug Geometry ---
    try {
      switch (shape.toLowerCase()) {
        case "box":
          const hx = options.hx || 0.1;
          const hy = options.hy || 0.1;
          const hz = options.hz || 0.1;
          this.tempVec3.setValue(hx, hy, hz);
          collisionShape = new Ammo.btBoxShape(this.tempVec3);
          effectiveHalfHeight = hy;
          const boxGeom = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
          debugMesh = new THREE.Mesh(boxGeom, debugMaterial);
          break;
        case "sphere":
          const radiusSphere = options.radius || 0.1;
          collisionShape = new Ammo.btSphereShape(radiusSphere);
          effectiveHalfHeight = radiusSphere;
          const sphereGeom = new THREE.SphereGeometry(radiusSphere, 16, 8);
          debugMesh = new THREE.Mesh(sphereGeom, debugMaterial);
          break;
        case "capsule":
          const radiusCapsule = options.radius || 0.1;
          const totalHeight = options.height || 0.2;
          const cylinderHeight = totalHeight - 2 * radiusCapsule;
          if (cylinderHeight < 0) {
            console.warn(
              "Capsule height invalid, using sphere shape for physics."
            );
            collisionShape = new Ammo.btSphereShape(radiusCapsule);
            effectiveHalfHeight = radiusCapsule;
            const sphereGeomFallback = new THREE.SphereGeometry(
              radiusCapsule,
              16,
              8
            );
            debugMesh = new THREE.Mesh(sphereGeomFallback, debugMaterial);
          } else {
            collisionShape = new Ammo.btCapsuleShape(
              radiusCapsule,
              cylinderHeight
            ); // Y-aligned
            effectiveHalfHeight = cylinderHeight / 2 + radiusCapsule;
            const capsuleGeom = new THREE.CapsuleGeometry(
              radiusCapsule,
              cylinderHeight,
              8,
              16
            );
            debugMesh = new THREE.Mesh(capsuleGeom, debugMaterial);
          }
          break;
        case "plane":
          this.tempVec3.setValue(
            options.normalX || 0,
            options.normalY || 1,
            options.normalZ || 0
          );
          collisionShape = new Ammo.btStaticPlaneShape(
            this.tempVec3,
            options.constant || 0
          );
          // No debug mesh for infinite plane
          break;
        default:
          console.error("Unsupported physics shape:", shape);
          return null;
      }
    } catch (e) {
      console.error(`Error creating Ammo shape "${shape}":`, e);
      return null;
    }

    // --- Create Transform and Motion State ---
    this.tempTransform.setIdentity();
    this.tempVec3.setValue(position.x, position.y, position.z);
    this.tempTransform.setOrigin(this.tempVec3);
    this.tempQuat.setValue(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );
    this.tempTransform.setRotation(this.tempQuat);
    const motionState = new Ammo.btDefaultMotionState(this.tempTransform);

    // --- Calculate Inertia ---
    this.tempVec3.setValue(0, 0, 0);
    if (mass > 0) collisionShape.calculateLocalInertia(mass, this.tempVec3);

    // --- Create Rigid Body ---
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      collisionShape,
      this.tempVec3
    );
    rbInfo.set_m_friction(friction);
    rbInfo.set_m_restitution(restitution);
    const body = new Ammo.btRigidBody(rbInfo);

    // --- ADD CCD FOR PLAYER ---
    if (options.isPlayerCharacter && mass > 0) {
      // Calculate motion threshold based on smallest dimension (e.g., radius)
      // If body moves more than this fraction of its size in one step, use CCD.
      const ccdMotionThreshold = (options.radius || 0.5) * 0.5; //50% of radius
      body.setCcdMotionThreshold(ccdMotionThreshold);

      // Set the radius of the sphere used for the sweep test.
      // Should be slightly smaller than the object's smallest dimension.
      const ccdSweptSphereRadius = (options.radius || 0.5) * 0.8; // 80% of radius
      body.setCcdSweptSphereRadius(ccdSweptSphereRadius);
      console.log(
        `PLAYER Body: Enabled CCD (Threshold: ${ccdMotionThreshold.toFixed(
          3
        )}, Radius: ${ccdSweptSphereRadius.toFixed(3)})`
      );
    }

    // --- Apply Body Settings ---
    if (isPlayerCharacter && mass > 0) {
      this.tempVec3.setValue(0, 0, 0); // Lock Y-axis rotation for player
      body.setAngularFactor(this.tempVec3);
    }
    if (neverSleep && mass > 0) {
      body.setActivationState(4); // DISABLE_DEACTIVATION
    }

    // locking Y-axis rotation for enemies
    const isCharacter =
      options.isPlayerCharacter || options.interactableType === "enemy"; // <<< CHECK if it's player OR enemy

    if (isCharacter && options.mass > 0) {
      // Apply to dynamic characters
      console.log(
        `Applying angular factor constraint to body (Player: ${!!options.isPlayerCharacter}, Enemy: ${
          options.interactableType === "enemy"
        })`
      ); // Log which constraint is applied
      // Constrain rotation to only allow Y-axis rotation (turning)
      this.tempVec3.setValue(0, 1, 0); // Allow Y rotation, lock X and Z rotation
      body.setAngularFactor(this.tempVec3);
    }

    // --- Add to World ---
    this.physicsWorld.addRigidBody(body);

    // --- Link & Add Debug Mesh ---
    const userData = {
      threeObject: threeObject,
      bodyHalfHeight: effectiveHalfHeight > 0 ? effectiveHalfHeight : 0,
      debugMesh: debugMesh, // Store debug mesh ref
      // --- Add node identification data from options ---
      nodeId: options.nodeId, // <<< STORE nodeId
      nodeName: options.nodeName, // <<< STORE nodeName
      // --- Add tree specific flags/data from options if passed ---
      // isTree: options.isTree === true,
      // isPlayer: options.isPlayerCharacter === true, // Consistent naming maybe?
      // --- Create Components based on options ---
      healthComponent:
        options.initialHealth !== undefined
          ? new HealthComponent(options.initialHealth, options.instanceId)
          : null,
      interactableComponent: options.interactionType
        ? new InteractableComponent(options.interactionType)
        : null,
      resourceNodeComponent: options.resourceId
        ? new ResourceNodeComponent(options.resourceId, options.resourceQty)
        : null,
      statsComponent: options.baseStats
        ? new StatsComponent(options.baseStats)
        : null,
      // instanceId TO userData DIRECTLY for easy access if needed >>>
      instanceId: options.instanceId,
    };
    body.userData = userData;

    // Link back from THREE object and copy component references
    if (threeObject) {
      threeObject.userData.physicsBody = body;
      // Copy flags and component references
      threeObject.userData.isPlayer = userData.isPlayer;
      // threeObject.userData.isTree = userData.isTree;
      threeObject.userData.healthComponent = userData.healthComponent; // Copy ref
      threeObject.userData.statsComponent = userData.statsComponent; // Copy ref
      threeObject.userData.abilityComponent = userData.abilityComponent; // Copy ref (if created here)
      threeObject.userData.interactableComponent =
        userData.interactableComponent; // Copy ref
      threeObject.userData.resourceNodeComponent =
        userData.resourceNodeComponent; // Copy ref
      // instanceId to model's userData too >>>
      threeObject.userData.instanceId = userData.instanceId;
    }

    if (debugMesh) {
      debugMesh.position.set(position.x, position.y, position.z);
      debugMesh.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      );
      this.debugGroup.add(debugMesh); // Add to debug group
      debugMesh.userData.physicsBody = body; // Link back
    }

    // --- Track Bodies ---
    // NOTE: Even static bodies might need tracking if they can become dynamic (like trees)
    // Let's track all bodies with userData for now, or create separate lists.
    // Or maybe just track dynamic bodies and find static ones via collision/raycast.
    // Keeping it simple: only dynamicBodies list updated for sync.
    if (mass > 0) this.dynamicBodies.push(body);

    // --- Cleanup ---
    Ammo.destroy(rbInfo);
    return body;
  }

  /** Creates a static ground plane body at Y=0 */
  createGroundPlane() {
    this.createBody({
      shape: "plane",
      mass: 0,
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      normalY: 1,
      constant: 0,
      friction: 0.8,
      restitution: 0.1,
    });
    console.log("PhysicsEngine: Created Ammo ground plane.");
  }

  /**
   * Checks if the given physics body is contacting the ground below it using a raycast.
   * @param {Ammo.btRigidBody} body - The physics body to check.
   * @param {number} [groundCheckDist=0.2] - How far below the body's bottom to cast the ray.
   * @returns {boolean} True if the ray hits something considered ground, false otherwise.
   */
  isBodyOnGround(body, groundCheckDist = 0.2) {
    if (!this.physicsWorld || !body) return false;
    const bodyHalfHeight = body.userData?.bodyHalfHeight;
    if (bodyHalfHeight === undefined) return false; // Cannot check without size info

    const transform = body.getWorldTransform();
    const origin = transform.getOrigin();
    const bodyOriginY = origin.y();
    const smallOffset = 0.05;
    const bottomY = bodyOriginY - bodyHalfHeight;
    const rayStartY = bottomY + smallOffset;
    const rayEndY = bottomY - groundCheckDist;

    const rayFrom = new Ammo.btVector3(origin.x(), rayStartY, origin.z());
    const rayTo = new Ammo.btVector3(origin.x(), rayEndY, origin.z());
    const rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);

    try {
      this.physicsWorld.rayTest(rayFrom, rayTo, rayCallback);
    } catch (e) {
      console.error("Error during rayTest:", e);
      Ammo.destroy(rayCallback);
      Ammo.destroy(rayFrom);
      Ammo.destroy(rayTo);
      return false;
    }

    let isOnGround = false;
    if (rayCallback.hasHit()) {
      const hitObj = rayCallback.get_m_collisionObject();
      // A more robust check involves collision filtering groups/masks
      if (hitObj !== body) {
        // Basic check: ensure we didn't hit ourselves
        // Further check: Is the hit object static?
        if (Ammo.btRigidBody.prototype.upcast(hitObj)?.isStaticObject()) {
          isOnGround = true;
        }
      }
    }

    Ammo.destroy(rayCallback);
    Ammo.destroy(rayFrom);
    Ammo.destroy(rayTo);
    return isOnGround;
  }

  /**
   * Performs a raycast and returns the first hit body (excluding a specified body).
   * @param {THREE.Vector3} rayFromWorld - Ray start point in world coordinates.
   * @param {THREE.Vector3} rayToWorld - Ray end point in world coordinates.
   * @param {Ammo.btRigidBody} [excludeBody=null] - Optional body to exclude from the results.
   * @returns {{body: Ammo.btRigidBody, point: Ammo.btVector3, normal: Ammo.btVector3} | null} The hit body, hit point, and hit normal, or null.
   */
  raycast(rayFromWorld, rayToWorld, excludeBody = null) {
    if (!this.physicsWorld) return null;

    const rayFrom = new Ammo.btVector3(
      rayFromWorld.x,
      rayFromWorld.y,
      rayFromWorld.z
    );
    const rayTo = new Ammo.btVector3(rayToWorld.x, rayToWorld.y, rayToWorld.z);
    const rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);
    // TODO: Add collision filtering if needed

    let hitResult = null; // <<< Store result object
    try {
      this.physicsWorld.rayTest(rayFrom, rayTo, rayCallback);
      if (rayCallback.hasHit()) {
        const hitObj = rayCallback.get_m_collisionObject();
        const body = Ammo.btRigidBody.prototype.upcast(hitObj);

        if (body && body !== excludeBody) {
          const hitPoint = rayCallback.get_m_hitPointWorld();
          const hitNormal = rayCallback.get_m_hitNormalWorld();
          hitResult = {
            body: body,
            // IMPORTANT: Create copies of Ammo vectors if storing long-term
            // For immediate use, direct access might be okay, but copy is safer.
            point: new Ammo.btVector3(hitPoint.x(), hitPoint.y(), hitPoint.z()), // Copy
            normal: new Ammo.btVector3(
              hitNormal.x(),
              hitNormal.y(),
              hitNormal.z()
            ), // Copy
          };
        }
      }
    } catch (e) {
      console.error("Error during PhysicsEngine.raycast:", e);
    } finally {
      // Cleanup Ammo objects
      Ammo.destroy(rayCallback);
      Ammo.destroy(rayFrom);
      Ammo.destroy(rayTo);
    }
    return hitResult;
  }

  /**
   * Gets the terrain normal vector at a given world X, Z coordinate using raycasting.
   * @param {number} x - World X coordinate.
   * @param {number} z - World Z coordinate.
   * @param {number} [rayStartHeight=100] - How high above the potential ground to start the ray.
   * @param {number} [rayEndHeight=-100] - How far below the potential ground to end the ray.
   * @returns {THREE.Vector3 | null} The normal vector (normalized) or null if terrain not hit.
   */
  getNormalAt(x, z, rayStartHeight = 100, rayEndHeight = -100) {
    if (!this.physicsWorld) return null;

    const rayFromWorld = new THREE.Vector3(x, rayStartHeight, z);
    const rayToWorld = new THREE.Vector3(x, rayEndHeight, z);

    // Perform raycast, excluding nothing specific (or exclude player)
    const hitResult = this.raycast(rayFromWorld, rayToWorld);

    let normal = null;
    if (
      hitResult?.body?.userData?.threeObject ===
      this.sceneRef?.getObjectByName("TerrainMesh")
    ) {
      // Check if terrain mesh has a name
      // Or check if the body is the terrain physics body reference if stored elsewhere
      const ammoNormal = hitResult.normal;
      normal = new THREE.Vector3(
        ammoNormal.x(),
        ammoNormal.y(),
        ammoNormal.z()
      ).normalize();
      Ammo.destroy(hitResult.point); // Clean up copied vectors from raycast result
      Ammo.destroy(hitResult.normal);
    }

    return normal;
  }

  /**
   * Makes a static body dynamic (e.g., a falling tree).
   * Updates mass, inertia, collision flags, and adds to dynamic list for syncing.
   * @param {Ammo.btRigidBody} body - The static body to make dynamic.
   * @param {number} [mass=100] - The mass to assign to the dynamic body.
   * @param {THREE.Vector3 | object} [initialImpulse=null] - Optional impulse {x,y,z} to apply.
   */
  makeBodyDynamic(body, mass = 100, initialImpulse = null) {
    if (!this.physicsWorld || !body || mass <= 0) {
      console.error("makeBodyDynamic: Invalid body, world, or mass <= 0.");
      return;
    }

    // --- Use isStaticObject() to check current state ---
    if (!body.isStaticObject()) {
      // Body is already dynamic or kinematic, don't change it again.
      // Or maybe isStaticObject() doesn't exist? Add check if needed: typeof body.isStaticObject !== 'function'
      console.warn("makeBodyDynamic called on a body that is not static.");
      return;
    }

    const shape = body.getCollisionShape();
    if (!shape) {
      console.error("makeBodyDynamic: Cannot get collision shape from body.");
      return;
    }

    try {
      // --- Calculate Local Inertia for the new dynamic mass ---
      const localInertia = this.tempVec3; // Reuse temp vector
      localInertia.setValue(0, 0, 0); // Zero it out first
      shape.calculateLocalInertia(mass, localInertia);

      // --- Set Mass Properties (makes body dynamic) ---
      body.setMassProps(mass, localInertia);
      body.updateInertiaTensor(); // Apply changes

      // --- IMPORTANT: Update Collision Flags ---
      const flags = body.getCollisionFlags();
      // Remove the static object flag (value 1) using bitwise AND NOT
      // Add default dynamic flag? Usually not needed unless specific filtering used.
      body.setCollisionFlags(flags & ~1); // flag '1' is Ammo.CollisionFlags.CF_STATIC_OBJECT
      // Now it should behave as a default dynamic object in collisions

      // --- Add to Dynamic List for Syncing ---
      // Ensure it's tracked for visual sync ONLY if not already there
      if (!this.dynamicBodies.includes(body)) {
        this.dynamicBodies.push(body);
        console.log(
          "Added previously static body to dynamicBodies list for sync."
        );
      }
      // --- End Add to Dynamic List ---

      // --- Wake up the body ---
      body.activate(true);

      // --- Apply optional initial impulse ---
      if (initialImpulse) {
        const impulseVec = this.tempVec3; // Reuse temp vector
        impulseVec.setValue(
          initialImpulse.x,
          initialImpulse.y,
          initialImpulse.z
        );
        // Apply impulse at the center of mass
        body.applyCentralImpulse(impulseVec);
        console.log("Applied initial fall impulse.");
      }

      console.log(
        "Made body dynamic:",
        body.userData?.threeObject?.name || "body"
      );
    } catch (e) {
      console.error("Error making body dynamic:", e);
      // If mass setting failed, it might still be static
      // Maybe try removing/re-adding if setMassProps causes issues? (More complex)
    }
  }

  /**
   * Finds the terrain height at a given world X, Z coordinate using raycasting.
   * @param {number} x - World X coordinate.
   * @param {number} z - World Z coordinate.
   * @param {number} [rayStartHeight=1000] - How high above the potential ground to start the ray.
   * @param {number} [rayEndHeight=-1000] - How far below the potential ground to end the ray.
   * @returns {number | null} The Y coordinate of the hit point, or null if nothing was hit.
   */
  getHeightAt(x, z, rayStartHeight = 1000, rayEndHeight = -1000) {
    if (!this.physicsWorld) return null;

    const rayFrom = new Ammo.btVector3(x, rayStartHeight, z);
    const rayTo = new Ammo.btVector3(x, rayEndHeight, z);
    // Use ALL_HITS callback if you need more info, but Closest should work for height.
    const rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);

    // Filter the raycast to potentially only hit terrain? (Optional, requires collision groups)
    // rayCallback.set_m_collisionFilterGroup(...)
    // rayCallback.set_m_collisionFilterMask(...)

    try {
      this.physicsWorld.rayTest(rayFrom, rayTo, rayCallback);
    } catch (e) {
      console.error("Error during getHeightAt rayTest:", e);
      Ammo.destroy(rayCallback);
      Ammo.destroy(rayFrom);
      Ammo.destroy(rayTo);
      return null;
    }

    let hitY = null;
    if (rayCallback.hasHit()) {
      const hitPoint = rayCallback.get_m_hitPointWorld();
      hitY = hitPoint.y();
      // console.log(`Height check at (${x.toFixed(1)}, ${z.toFixed(1)}): Hit Y=${hitY.toFixed(3)}`);
    } else {
      // console.log(`Height check at (${x.toFixed(1)}, ${z.toFixed(1)}): MISS`);
    }

    Ammo.destroy(rayCallback);
    Ammo.destroy(rayFrom);
    Ammo.destroy(rayTo);
    return hitY;
  }

  /**
   * Directly sets the world transform (position and rotation) of a physics body
   * and resets its velocities. Use for teleporting or resetting.
   * @param {Ammo.btRigidBody} body - The Ammo body to modify.
   * @param {object} position - The target position { x, y, z }.
   * @param {object} quaternion - The target rotation { x, y, z, w }.
   */
  setBodyTransform(body, position, quaternion) {
    if (!body) {
      console.warn("setBodyTransform: Invalid body provided.");
      return;
    }

    // Get the body's current transform to modify it
    const transform = body.getWorldTransform(); // Or body.getCenterOfMassTransform()? Usually world transform is better.

    // Set new origin (position)
    this.tempVec3.setValue(position.x, position.y, position.z);
    transform.setOrigin(this.tempVec3);

    // Set new rotation
    this.tempQuat.setValue(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );
    transform.setRotation(this.tempQuat);

    // Apply the modified transform back to the body
    body.setWorldTransform(transform);

    // Also apply to motion state if it exists (important!)
    const motionState = body.getMotionState();
    if (motionState) {
      motionState.setWorldTransform(transform);
    }

    // --- Reset Velocities ---
    // Zero out linear velocity
    this.tempVec3.setValue(0, 0, 0);
    body.setLinearVelocity(this.tempVec3);
    // Zero out angular velocity
    body.setAngularVelocity(this.tempVec3);
    // Ensure body doesn't continue rolling due to factors we haven't reset

    // Wake the body up
    body.activate(true);

    console.log(
      `PhysicsEngine: Set body transform to Pos:(${position.x.toFixed(
        1
      )},${position.y.toFixed(1)},${position.z.toFixed(1)})`
    );
  }

  /**
   * Advances the physics simulation and updates linked THREE.js objects & debug visuals.
   * @param {number} delta - Time elapsed since the last frame (seconds).
   */
  update(delta) {
    if (!this.physicsWorld) return;

    const clampedDelta = Math.min(delta, 0.1); // Keep delta clamping

    const maxSubSteps = 20;
    const fixedTimeStep = 1 / 120;
    try {
      this.physicsWorld.stepSimulation(
        clampedDelta,
        maxSubSteps,
        fixedTimeStep
      );
    } catch (e) {
      console.error("Error during physics step:", e);
    }

    this._handleCollisions(); // Process collisions (stubbed)
    this._syncVisuals(); // Update visual positions/rotations
  }

  // -----------------------------------------------------------------------------
  // IMPORTANT
  // -----------------------------------------------------------------------------
  // *****************************************************************************
  // DON'T DELETE - Original code for models not being shit!
  // /** Internal: Updates THREE.js object transforms AND debug meshes from physics bodies. */
  // _syncVisuals() {
  //   for (const body of this.dynamicBodies) {
  //     // Get linked objects from userData
  //     const threeObject = body.userData?.threeObject;
  //     const debugMesh = body.userData?.debugMesh;

  //     // Check if body is valid and has a motion state to sync from
  //     if (
  //       body &&
  //       body.getMotionState &&
  //       (body.isActive() || !body.isStaticObject())
  //     ) {
  //       const motionState = body.getMotionState();
  //       if (motionState) {
  //         motionState.getWorldTransform(this.tempTransform); // Get current physics transform

  //         const origin = this.tempTransform.getOrigin();
  //         const rotation = this.tempTransform.getRotation();

  //         // Sync Main Visual Mesh (Player has special handling)
  //         if (threeObject) {
  //           const isPlayer = threeObject.userData?.isPlayer === true;
  //           const bodyHalfHeight = body.userData?.bodyHalfHeight || 0;

  //           // Position: Apply offset ONLY for player based on half-height
  //           if (isPlayer && bodyHalfHeight > 0) {
  //             threeObject.position.set(
  //               origin.x(),
  //               origin.y() - bodyHalfHeight,
  //               origin.z()
  //             );
  //           } else {
  //             // Sync directly for all other objects (including falling logs)
  //             threeObject.position.set(origin.x(), origin.y(), origin.z());
  //           }

  //           // Rotation: Sync rotation for all dynamic objects EXCEPT the player
  //           if (!isPlayer) {
  //             threeObject.quaternion.set(
  //               rotation.x(),
  //               rotation.y(),
  //               rotation.z(),
  //               rotation.w()
  //             );
  //           }
  //         }

  //         // Sync Debug Visual Mesh (Always matches physics body exactly)
  //         if (debugMesh) {
  //           debugMesh.position.set(origin.x(), origin.y(), origin.z());
  //           debugMesh.quaternion.set(
  //             rotation.x(),
  //             rotation.y(),
  //             rotation.z(),
  //             rotation.w()
  //           );
  //         }
  //       }
  //     }
  //   }

  // /** Internal: Updates THREE.js object transforms AND debug meshes from physics bodies. */
  // _syncVisuals() {
  //   // Reusable vectors within the loop if needed, or use class members like tempTransform
  //   const position = new THREE.Vector3();
  //   const quaternion = new THREE.Quaternion();

  //   for (const body of this.dynamicBodies) {
  //     const motionState = body.getMotionState();

  //     // Check if body is active/valid and has a motion state
  //     if (motionState && (body.isActive() || !body.isStaticObject())) {
  //       motionState.getWorldTransform(this.tempTransform); // Get current physics transform

  //       const origin = this.tempTransform.getOrigin(); // Physics CENTER position
  //       const rotation = this.tempTransform.getRotation(); // Physics rotation

  //       // Update linked threeObject (visual model)
  //       const threeObject = body.userData?.threeObject;
  //       if (threeObject) {
  //         const isPlayer = threeObject.userData?.isPlayer === true;
  //         const bodyHalfHeight = body.userData?.bodyHalfHeight; // Get stored half-height

  //         // Apply offset logic if bodyHalfHeight is available (assumes feet origin for model)
  //         if (bodyHalfHeight && bodyHalfHeight > 0) {
  //           position.set(
  //             origin.x(),
  //             origin.y() - bodyHalfHeight, // Center Y - Half Height = Feet Y
  //             origin.z()
  //           );
  //         } else {
  //           // Fallback: If no half-height info, position origin at physics center
  //           position.set(origin.x(), origin.y(), origin.z());
  //         }
  //         threeObject.position.copy(position);

  //         // --- Rotation Logic (Apply only to non-player objects) ---
  //         if (!isPlayer) {
  //           quaternion.set(
  //             rotation.x(),
  //             rotation.y(),
  //             rotation.z(),
  //             rotation.w()
  //           );
  //           threeObject.quaternion.copy(quaternion);
  //         }
  //         // --- End Rotation Logic ---
  //       }

  //       // Update Debug Visual Mesh (Always matches physics body exactly)
  //       const debugMesh = body.userData?.debugMesh;
  //       if (debugMesh) {
  //         debugMesh.position.set(origin.x(), origin.y(), origin.z());
  //         debugMesh.quaternion.set(
  //           rotation.x(),
  //           rotation.y(),
  //           rotation.z(),
  //           rotation.w()
  //         );
  //       }
  //     }
  //   }
  // }

  // /** Internal: Updates THREE.js object transforms AND debug meshes from physics bodies. */
  // _syncVisuals() {
  //   const position = new THREE.Vector3();
  //   const quaternion = new THREE.Quaternion();

  //   for (const body of this.dynamicBodies) {
  //     const motionState = body.getMotionState();

  //     if (motionState && (body.isActive() || !body.isStaticObject())) {
  //       motionState.getWorldTransform(this.tempTransform); // Get current physics transform

  //       const origin = this.tempTransform.getOrigin(); // Physics CENTER position
  //       const rotation = this.tempTransform.getRotation(); // Physics rotation

  //       // Update linked threeObject (visual model)
  //       const threeObject = body.userData?.threeObject;
  //       if (threeObject) {
  //         const bodyHalfHeight = body.userData?.bodyHalfHeight;
  //         const isPlayer = threeObject.userData?.isPlayer === true;
  //         // --- ADD check for collectable/loot item ---
  //         const isCollectable =
  //           body.userData?.interactableComponent?.type === "collectable";

  //         // --- REVISED POSITIONING LOGIC ---
  //         // Apply offset logic ONLY if bodyHalfHeight is valid AND it's NOT a collectable item
  //         // (Assuming collectables use default center-origin geometry, while player/enemies use feet-origin)
  //         if (bodyHalfHeight && bodyHalfHeight > 0 && !isCollectable) {
  //           // For Player and Enemies (assuming feet origin)
  //           position.set(
  //             origin.x(),
  //             origin.y() - bodyHalfHeight, // Center Y - Half Height = Feet Y
  //             origin.z()
  //           );
  //         } else {
  //           // For Collectable Loot (center origin) OR objects without height info
  //           // Position origin directly at physics center
  //           position.set(origin.x(), origin.y(), origin.z());
  //         }
  //         threeObject.position.copy(position);
  //         // --- END REVISED POSITIONING LOGIC ---

  //         // --- Rotation Logic (Apply only to non-player objects like enemies/logs) ---
  //         // Maybe apply to collectables too if they should rotate with physics?
  //         if (!isPlayer) {
  //           quaternion.set(
  //             rotation.x(),
  //             rotation.y(),
  //             rotation.z(),
  //             rotation.w()
  //           );
  //           threeObject.quaternion.copy(quaternion);
  //         }
  //         // --- End Rotation Logic ---
  //       }

  //       // Update Debug Visual Mesh (Always matches physics body center)
  //       const debugMesh = body.userData?.debugMesh;
  //       if (debugMesh) {
  //         debugMesh.position.set(origin.x(), origin.y(), origin.z());
  //         debugMesh.quaternion.set(
  //           rotation.x(),
  //           rotation.y(),
  //           rotation.z(),
  //           rotation.w()
  //         );
  //       }
  //     }
  //   }
  // }

  /** Internal: Updates THREE.js object transforms AND debug meshes from physics bodies. */
  _syncVisuals() {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    for (const body of this.dynamicBodies) {
      const motionState = body.getMotionState();

      if (motionState && (body.isActive() || !body.isStaticObject())) {
        // --- ***** ADD Check for DEAD AI State ***** ---
        // const aiState = body.userData?.aiComponent?.currentState;
        if (body.userData?.isDead === true) {
          // If dead, let animation handle the visual model entirely.
          // Do NOT sync physics transform to visual transform.
          // We still need to update the debug mesh if visible.
          const debugMesh = body.userData?.debugMesh;
          if (debugMesh && this.debugGroup.visible) {
            // Check if debug is globally visible
            motionState.getWorldTransform(this.tempTransform);
            const origin = this.tempTransform.getOrigin();
            const rotation = this.tempTransform.getRotation();
            debugMesh.position.set(origin.x(), origin.y(), origin.z());
            debugMesh.quaternion.set(
              rotation.x(),
              rotation.y(),
              rotation.z(),
              rotation.w()
            );
          }
          continue; // Skip visual sync for this dead enemy
        }
        // --- ***** END DEAD AI State Check ***** ---

        motionState.getWorldTransform(this.tempTransform); // Get physics transform

        const origin = this.tempTransform.getOrigin(); // Physics CENTER position
        const rotation = this.tempTransform.getRotation(); // Physics body's rotation

        const threeObject = body.userData?.threeObject;
        if (threeObject) {
          const isPlayer = threeObject.userData?.isPlayer === true;
          const isCollectable =
            body.userData?.interactableComponent?.type === "collectable";
          // *** ADD Check: Identify if this body is an AI-controlled enemy ***
          // (Assuming 'enemy' type in interactableComponent indicates AI control)
          const isAiControlledEnemy =
            body.userData?.interactableComponent?.type === "enemy";

          // --- Positioning Logic --- (Keep as is)
          const bodyHalfHeight = body.userData?.bodyHalfHeight;
          if (bodyHalfHeight && bodyHalfHeight > 0 && !isCollectable) {
            position.set(origin.x(), origin.y() - bodyHalfHeight, origin.z());
          } else {
            position.set(origin.x(), origin.y(), origin.z());
          }
          threeObject.position.copy(position);

          // --- Rotation Logic ---
          // Sync physics rotation ONLY if it's NOT the player AND NOT an AI-controlled enemy
          // Let PlayerController handle player rotation and AISystem handle enemy rotation.
          if (!isPlayer && !isAiControlledEnemy) {
            // Apply physics rotation to other dynamic objects (e.g., falling logs, maybe collectables)
            quaternion.set(
              rotation.x(),
              rotation.y(),
              rotation.z(),
              rotation.w()
            );
            threeObject.quaternion.copy(quaternion);
          }
          // --- Player and AI Enemy rotation are handled elsewhere ---
        } // End if (threeObject)

        // --- Debug Mesh Sync --- (Keep as is - debug mesh always matches physics body)
        const debugMesh = body.userData?.debugMesh;
        if (debugMesh) {
          debugMesh.position.set(origin.x(), origin.y(), origin.z());
          debugMesh.quaternion.set(
            rotation.x(),
            rotation.y(),
            rotation.z(),
            rotation.w()
          );
        }
      } // End if (motionState && ...)
    } // End for loop
  } // End _syncVisuals

  /** Internal: Processes collision events (Placeholder) */
  _handleCollisions() {
    // ...
  }

  /** Remove a body and associated THREE object link AND debug mesh */
  removeBody(body) {
    if (!this.physicsWorld || !body) return;
    try {
      // Remove Debug Mesh first
      const debugMesh = body.userData?.debugMesh;
      if (debugMesh) {
        this.debugGroup.remove(debugMesh);
        if (debugMesh.geometry) debugMesh.geometry.dispose();
        // Material is shared, don't dispose here unless it's unique
        delete debugMesh.userData.physicsBody;
      }

      // Remove Physics Body
      this.physicsWorld.removeRigidBody(body);
      const index = this.dynamicBodies.indexOf(body);
      if (index > -1) this.dynamicBodies.splice(index, 1);

      // Clean up links and Ammo objects
      if (body.userData?.threeObject) {
        delete body.userData.threeObject.userData.physicsBody;
      }
      if (body.getMotionState()) Ammo.destroy(body.getMotionState());
      if (body.getCollisionShape()) Ammo.destroy(body.getCollisionShape());
      Ammo.destroy(body);
      // console.log("PhysicsEngine: Removed and destroyed Ammo body.");
    } catch (e) {
      console.error("Error removing physics body:", e);
    }
  }

  /** Toggle visibility of the debug shapes */
  toggleDebug(visible) {
    if (typeof visible === "boolean") {
      this.debugGroup.visible = visible;
    } else {
      this.debugGroup.visible = !this.debugGroup.visible;
    }
    console.log(`Physics debug set to: ${this.debugGroup.visible}`);
  }

  // TODO: Implement destroy() method for full cleanup
  destroy() {
    console.log("PhysicsEngine: Destroying world (STUB)...");
    // Loop through all bodies, remove them using removeBody()
    // Then destroy world, solver, broadphase, dispatcher, config...
    // Remove debug group from scene
  }
} // End Class

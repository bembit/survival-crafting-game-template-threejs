// src/game/world/Terrain.js
import * as THREE from "three";
// Assuming Ammo is loaded globally
import { mulberry32 } from "../utils/PRNG.js";
import { cyrb128 } from "../utils/PRNG.js";

export class Terrain {
  /** @type {THREE.Mesh | null} The visual terrain mesh. */
  mesh = null;
  /** @type {Ammo.btRigidBody | null} The physics body for the terrain. */
  physicsBody = null;
  /** @type {PhysicsEngine} Reference to the physics engine instance. */
  physicsEngine;
  /** @type {SceneManager} Reference to the scene manager instance. */
  sceneManager;

  /**
   * @param {SceneManager} sceneManager
   * @param {PhysicsEngine} physicsEngine
   */
  constructor(sceneManager, physicsEngine) {
    this.sceneManager = sceneManager;
    this.physicsEngine = physicsEngine;
  }

  /**
   * Generates the terrain mesh and physics body.
   * @param {object} options - Configuration like size, segments.
   * @param {number} [options.size=400] - Width/Length of the terrain plane.
   * @param {number} [options.segments=200] - Number of segments (resolution).
   * @param {number} [options.maxHeight=8] - Max height variation for inner terrain bumps/noise.
   * @param {string | number | null} [options.seed=null] - Seed for potential deterministic generation.
   */
  generate(options = {}) {
    const size = options.size ?? 400;
    const segments = options.segments ?? 200;
    const maxHeight = options.maxHeight ?? 8;
    const seed = options.seed ?? "defaultSeed";

    console.log(
      `Generating terrain: Size=${size}, Segments=${segments}, MaxHeight=${maxHeight}`
    );

    const numericSeed = cyrb128(String(seed));
    const random = mulberry32(numericSeed);
    console.log(`Terrain using numeric seed: ${numericSeed}`);

    // --- Edge Generation Parameters ---
    const edgeWidth = 25.0;
    const edgeMaxHeight = 15.0; // Max height for edge zone
    const edgeSharpness = 3.0;
    const edgeNoiseFreq = 0.1;
    const edgeNoiseAmp = 4.0;
    // ---

    // --- Inner Terrain Parameters ---
    const centerFlatRadius = size * 0.2;
    const hillTransitionWidth = size * 0.3;
    const maxHillHeight = maxHeight * 3.0; // Max height for inner zone hills
    const centerBumpAmplitude = maxHeight * 1;
    const edgeBumpAmplitude = maxHeight * 0.6;
    const baseFrequency = 8.0 / size;
    const noiseFactor = maxHeight * 0.02;
    // ---

    // --- Vertex Color Gradient Definition ---
    const COLOR_GRASS = new THREE.Color(0x669944); // Lowest areas
    const COLOR_ICE = new THREE.Color(0xc6e9e8); // Low-mid areas
    // const COLOR_ROCK = new THREE.Color(0x888877); // Mid-heights
    const COLOR_ROCK = new THREE.Color(0x74a4a3); // Mid-heights

    // const COLOR_SNOW = new THREE.Color(0xe1e1e1); // Peaks (slightly off-white)
    // const COLOR_SNOW = new THREE.Color(0xffffff); // Peaks (slightly off-white)
    // const COLOR_SNOW = new THREE.Color(0xbffdfd); // Peaks (slightly off-white)
    const COLOR_SNOW = new THREE.Color(0xe0ffff); // Peaks (slightly off-white)
    // Estimate approximate height range for color mapping
    // Min height could be negative due to noise, max is likely edgeMaxHeight + noise
    const estimatedMinHeight = -maxHeight * 0.5; // Estimate some negative depth
    const estimatedMaxHeight = edgeMaxHeight + edgeNoiseAmp; // Tallest possible peak
    const heightRange = estimatedMaxHeight - estimatedMinHeight;
    // ---

    // 1. Create THREE.js Geometry
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const positionAttribute = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    const halfSize = size / 2.0;

    const colors = []; // <<< Array to hold vertex colors

    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i);
      const x = vertex.x;
      const y = vertex.y;

      // --- Calculate Inner Terrain Height FIRST ---
      const distFromCenter = Math.sqrt(x * x + y * y);
      const edgeWeight = THREE.MathUtils.smoothstep(
        distFromCenter,
        centerFlatRadius,
        centerFlatRadius + hillTransitionWidth
      );
      const baseHeight = edgeWeight * maxHillHeight;
      const currentBumpAmplitude = THREE.MathUtils.lerp(
        centerBumpAmplitude,
        edgeBumpAmplitude,
        edgeWeight
      );
      const bumps =
        currentBumpAmplitude *
        (Math.sin(x * baseFrequency) + Math.cos(y * baseFrequency * 1.3));
      const noise = (random() - 0.5) * 2.0 * noiseFactor;
      let finalHeight = baseHeight + bumps + noise;
      // --- End Inner Terrain Calculation ---

      const distFromEdgeX = halfSize - Math.abs(x);
      const distFromEdgeY = halfSize - Math.abs(y);
      const distToNearestEdge = Math.min(distFromEdgeX, distFromEdgeY);

      // --- Check if vertex is in the edge zone ---
      if (distToNearestEdge < edgeWidth) {
        // --- Edge Zone Calculation ---
        const edgeProgress = 1.0 - distToNearestEdge / edgeWidth;
        const sharpProgress = Math.pow(edgeProgress, edgeSharpness);
        const baseEdgeHeight = sharpProgress * edgeMaxHeight;
        const noiseX =
          Math.sin(x * edgeNoiseFreq + random() * 0.5) *
          Math.cos(y * edgeNoiseFreq * 0.8 + random() * 0.5);
        const edgeNoise = noiseX * edgeNoiseAmp * (0.5 + edgeProgress * 0.5);
        // --- Add Edge Height to the existing Inner Height ---
        finalHeight += baseEdgeHeight + edgeNoise;
      }

      // Apply the final combined height
      positionAttribute.setZ(i, finalHeight);

      // --- Calculate Vertex Color Based on Height  ---
      const normalizedHeight = THREE.MathUtils.clamp(
        (finalHeight - estimatedMinHeight) / heightRange,
        0.0,
        1.0 // Clamp between 0 and 1
      );

      const vertexColor = new THREE.Color();

      // Lowest THRESHOLD: GRASS
      if (normalizedHeight < 0.08) {
        const grassLerpFactor = THREE.MathUtils.mapLinear(
          normalizedHeight,
          0.0,
          0.08,
          0.0,
          1.0
        ); // <-- Treshold values adjusted here
        vertexColor.lerpColors(COLOR_GRASS, COLOR_ICE, grassLerpFactor);
        // vertexColor.copy(COLOR_GRASS);
      }
      // Simple gradient: Grass -> Rock -> Snow
      // <<< THRESHOLD 1: Below this value is pure Grass
      else if (normalizedHeight < 0.4) {
        vertexColor.copy(COLOR_ICE);
      }
      // <<< THRESHOLD 2: Between THRESHOLD 1 and this value, lerp Grass->Rock
      else if (normalizedHeight < 0.75) {
        // Lerp between Grass and Rock
        // The mapLinear function takes the current height and remaps it from the
        // range [0.4, 0.75] to the range [0.0, 1.0] for the lerp function.
        const rockLerpFactor = THREE.MathUtils.mapLinear(
          normalizedHeight,
          0.4,
          0.75,
          0.0,
          1.0
        );
        vertexColor.lerpColors(COLOR_ICE, COLOR_ROCK, rockLerpFactor);
      }
      // <<< Above THRESHOLD 2, lerp Rock->Snow
      else {
        // Lerp between Rock and Snow
        // Remaps height from [0.75, 1.0] to [0.0, 1.0] for lerp.
        const snowLerpFactor = THREE.MathUtils.mapLinear(
          normalizedHeight,
          0.75,
          1.0,
          0.0,
          1.0
        );
        vertexColor.lerpColors(COLOR_ROCK, COLOR_SNOW, snowLerpFactor);
      }

      // Add calculated color to the array
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
    geometry.computeVertexNormals();

    // color attribute to the geometry
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    // 2. Create THREE.js Material and Mesh
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, // <<< ENABLE VERTEX COLORS
      // color: 0xffffff, // Base color is now mixed with vertex colors, white works well
      // wireframe: true,
      roughness: 0.6, // Adjust for desired surface look
      metalness: 0.1, // Low metalness for terrain usually
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2.0; // Rotate flat
    this.mesh.receiveShadow = true;
    // might be?
    // this.mesh.castShadow = true;
    this.mesh.name = "TerrainMesh";

    // 3. Create Ammo.js Physics Shape
    this.physicsBody = this._createAmmoShapeFromGeometry(geometry);
    if (!this.physicsBody) {
      console.error("Failed to create terrain physics body.");
      return;
    }
    // Link visual mesh to physics body
    this.physicsBody.userData = { threeObject: this.mesh };
    this.mesh.userData.physicsBody = this.physicsBody;

    // 4. Add visual mesh to the scene
    this.sceneManager.add(this.mesh);
    console.log(
      "Terrain generated with vertex colors and added to scene/physics."
    );
  }

  // ... (_createAmmoShapeFromGeometry and destroy methods remain the same) ...
  _createAmmoShapeFromGeometry(geometry) {
    const ammoTriangleMesh = new Ammo.btTriangleMesh(true, true); // Use default flags
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index.array;
    const vec1 = new Ammo.btVector3(0, 0, 0);
    const vec2 = new Ammo.btVector3(0, 0, 0);
    const vec3 = new Ammo.btVector3(0, 0, 0);

    // Iterate through faces (triangles) based on indices
    for (let i = 0; i < indices.length; i += 3) {
      const index1 = indices[i];
      const index2 = indices[i + 1];
      const index3 = indices[i + 2];

      // Set Ammo vectors from THREE geometry vertices (Z becomes height)
      vec1.setValue(
        vertices[index1 * 3],
        vertices[index1 * 3 + 1],
        vertices[index1 * 3 + 2]
      );
      vec2.setValue(
        vertices[index2 * 3],
        vertices[index2 * 3 + 1],
        vertices[index2 * 3 + 2]
      );
      vec3.setValue(
        vertices[index3 * 3],
        vertices[index3 * 3 + 1],
        vertices[index3 * 3 + 2]
      );

      // Add the triangle to the Ammo mesh
      ammoTriangleMesh.addTriangle(vec1, vec2, vec3, false); // false = remove duplicate vertices (optional)
    }

    // Create the shape using the triangle mesh
    const shape = new Ammo.btBvhTriangleMeshShape(ammoTriangleMesh, true, true); // Use default build/flags

    // Create the static rigid body (mass 0)
    // IMPORTANT: Apply the same rotation as the visual mesh!
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 0, 0)); // Position at origin
    // Create quaternion for -90 deg rotation around X
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    const ammoQuat = new Ammo.btQuaternion(q.x, q.y, q.z, q.w);
    transform.setRotation(ammoQuat);

    const motionState = new Ammo.btDefaultMotionState(transform);
    // Note: inertia calculation not needed for mass 0
    const localInertia = new Ammo.btVector3(0, 0, 0);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      motionState,
      shape,
      localInertia
    );
    // Set friction/restitution for terrain
    rbInfo.set_m_friction(0.8);
    rbInfo.set_m_restitution(0.1);

    const body = new Ammo.btRigidBody(rbInfo);

    // Add the body to the physics world
    this.physicsEngine.physicsWorld.addRigidBody(body);

    // Cleanup temporary Ammo objects - IMPORTANT!
    Ammo.destroy(vec1);
    Ammo.destroy(vec2);
    Ammo.destroy(vec3);
    Ammo.destroy(localInertia);
    // NOTE: Do NOT destroy ammoTriangleMesh here, the shape needs it.
    // It might need to be stored and destroyed later when terrain is removed.
    // Store it on the body's userData?
    body.userData = body.userData || {};
    body.userData.triangleMesh = ammoTriangleMesh; // Store for later cleanup

    Ammo.destroy(rbInfo); // Can destroy info object

    return body;
  }

  /** Perform cleanup when terrain is destroyed */
  destroy() {
    if (this.mesh) this.sceneManager.remove(this.mesh);
    if (this.physicsBody) {
      // Destroy the associated triangle mesh first if stored
      if (this.physicsBody.userData?.triangleMesh) {
        Ammo.destroy(this.physicsBody.userData.triangleMesh);
      }
      this.physicsEngine.removeBody(this.physicsBody); // Use engine's remove method
    }
    if (this.mesh?.geometry) this.mesh.geometry.dispose();
    if (this.mesh?.material) this.mesh.material.dispose();
    console.log("Terrain destroyed.");
  }
}

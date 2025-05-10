// src/game/world/SceneManager.js
import * as THREE from "three";
import { SCENE_CONFIG } from "../config/SceneConfig.js";

/**
 * Manages the core THREE.js scene, camera, lights, and background.
 * Provides methods for adding/removing objects and accessing core components.
 */
export class SceneManager {
  /** @type {THREE.Scene} The main scene graph. */
  scene;
  /** @type {THREE.PerspectiveCamera} The primary camera. */
  camera;

  // sunlight properties
  sunlight;
  ambientLight;

  sunMesh = null; // property for visual sun
  starSystem = null; // Property for the star points object
  cloudMeshes = []; // To hold cloud objects

  moonLight = null;
  environmentLights = []; // For point lights like campfires

  physicsEngine = null;

  performanceProfile = null; // Store profile

  fogInstance = null;

  constructor(physicsEngine, performanceProfile) {
    if (!physicsEngine) {
      // Add a check here too, for safety during instantiation
      console.error(
        "SceneManager constructor: PhysicsEngine instance is required!"
      );
      // Throw an error or handle it gracefully
      // throw new Error("PhysicsEngine instance is required for SceneManager.");
    }
    this.physicsEngine = physicsEngine;

    this.performanceProfile = performanceProfile || {
      shadowMapSize: 4096,
      maxShadowCastingLights: 10,
    }; // Default if none provided

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR);

    this.scene.fog = null; // Initialize scene fog to null

    this.camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.CAMERA_FOV,
      window.innerWidth / window.innerHeight, // Initial aspect ratio
      SCENE_CONFIG.CAMERA_NEAR,
      SCENE_CONFIG.CAMERA_FAR
    );
    // Initial camera position (can be adjusted or set by CameraController later)
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this._addLights();

    this._addMoonlight(); // Moonlight

    // this._addTile(); // Add ground plane automatically for now
    this._addClouds();
    this._addStars();

    // this._addEnvironmentLights();

    this._addVisualSun();
  }

  // --- Fog Methods ---
  enableFog(color = 0xcccccc, near = 10, far = 100) {
    if (!this.scene) return;
    console.log(
      `Enabling Linear Fog: Color=${color.toString(
        16
      )}, Near=${near}, Far=${far}`
    );
    this.scene.fog = new THREE.Fog(color, near, far);
  }

  enableExpFog(color = 0xcccccc, density = 0.02) {
    if (!this.scene) return;
    console.log(
      `Enabling Exp2 Fog: Color=${color.toString(16)}, Density=${density}`
    );
    this.scene.fog = new THREE.FogExp2(color, density);
  }

  disableFog() {
    if (!this.scene) return;
    if (this.scene.fog) {
      console.log("Disabling Fog");
      this.scene.fog = null;
    }
  }

  // <<< Public Method to set final X Y Z positions >>>
  finalizeEnvironmentPositions() {
    if (!this.physicsEngine) {
      console.error(
        "SceneManager: Cannot finalize positions, PhysicsEngine not available."
      );
      return;
    }
    console.log(
      `Finalizing positions for ${this.environmentLights.length} environment lights...`
    );

    this.environmentLights.forEach((light) => {
      const visualGroup = light.userData.visualMesh;
      const intendedXZ = light.userData.intendedXZ; // { x, z }

      if (visualGroup && intendedXZ) {
        const terrainY = this.physicsEngine.getHeightAt(
          intendedXZ.x,
          intendedXZ.z
        );
        const finalY = terrainY ?? visualGroup.position.y; // Fallback to current Y if height check fails

        console.log(
          `Finalizing ${light.name}: Height at (${intendedXZ.x.toFixed(
            1
          )}, ${intendedXZ.z.toFixed(1)}) -> ${
            terrainY === null ? "NULL" : terrainY?.toFixed(2)
          }. Final Y: ${finalY.toFixed(2)}`
        );

        // Update the visual group's Y position
        visualGroup.position.y = finalY;

        // Update the light's FULL position (X, Y, and Z)
        // Set X and Z from intendedXZ, and calculate Y
        light.position.set(
          intendedXZ.x,
          finalY + 0.5, // Light source slightly above base
          intendedXZ.z
        );
      } else {
        console.warn(
          `Skipping position finalization for light ${light.name}: Missing visualGroup or intendedXZ.`
        );
      }
    });
    console.log("Finished finalizing environment light positions.");
  }

  _addEnvironmentLights() {
    // Clear previous if re-initializing
    // TODO: Add proper cleanup if re-running this
    // this.environmentLights.forEach(light => { /* remove light and visual */ });
    this.environmentLights = [];
    // this.environmentLightPositions = []; // Clear positions too

    console.log("SceneManager: Preparing environment lights...");
    // Store positions to add later
    const campfirePositions = [
      new THREE.Vector3(1, 0, 1), // Close position for testing
      new THREE.Vector3(15, 0, 20),
      // new THREE.Vector3(-30, 0, -10),
      new THREE.Vector3(-124, 0, -125),
      new THREE.Vector3(-99, 0, -10),
      new THREE.Vector3(-30, 0, -77),
      new THREE.Vector3(30, 0, 77),
      // mountain ones
      new THREE.Vector3(168, 0, -178),
      new THREE.Vector3(-168, 0, 178),

      new THREE.Vector3(87, 0, -30),

      new THREE.Vector3(151, 0, 65.5),
      new THREE.Vector3(56, 0, 126),

      new THREE.Vector3(-43, 0, 86),
    ];

    campfirePositions.forEach((pos) => {
      this._addCampfirePlaceholder(pos); // Call the creation method
    });

    console.log(
      `Prepared ${this.environmentLights.length} environment lights (positioning pending).`
    );
  }

  // --- Reusable Campfire Creation Method ---
  createCampfireObject(position) {
    const campfireGroup = new THREE.Group();
    campfireGroup.position.copy(position); // Set base position

    // --- Visuals (Logs, Rocks, Embers) ---
    // (Copy the visual creation logic from your existing _addCampfirePlaceholder method here)
    // turn off shadows on these?
    const logMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.8,
    });
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x6c757d,
      roughness: 0.7,
    });
    const logGeometry = new THREE.CylinderGeometry(0.1, 0.12, 1.0, 6);
    const rockGeometry = new THREE.IcosahedronGeometry(0.15, 0);
    const emberMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.7,
    });
    const emberGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    const logCount = 3,
      rockCount = 5;
    const logRadiusPlacement = 0.3,
      rockRadiusPlacement = 0.5;
    for (let i = 0; i < logCount; i++) {
      /* ... add log meshes ... */
      const angle = (i / logCount) * Math.PI * 2 + Math.random() * 0.5;
      const logMesh = new THREE.Mesh(logGeometry, logMaterial);
      logMesh.position.set(
        Math.cos(angle) * logRadiusPlacement,
        0.1,
        Math.sin(angle) * logRadiusPlacement
      );
      logMesh.rotation.y = -angle + Math.PI / 2;
      logMesh.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      logMesh.castShadow = true;
      logMesh.receiveShadow = true;
      campfireGroup.add(logMesh);
    }
    for (let i = 0; i < rockCount; i++) {
      /* ... add rock meshes ... */
      const angle = Math.random() * Math.PI * 2;
      const dist = rockRadiusPlacement * (0.8 + Math.random() * 0.4);
      const rockMesh = new THREE.Mesh(rockGeometry, rockMaterial);
      rockMesh.scale.setScalar(0.8 + Math.random() * 0.4);
      rockMesh.position.set(
        Math.cos(angle) * dist,
        0.08 * rockMesh.scale.y,
        Math.sin(angle) * dist
      );
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      campfireGroup.add(rockMesh);
    }
    const emberMesh = new THREE.Mesh(emberGeometry, emberMaterial);
    emberMesh.position.y = 0.15;
    campfireGroup.add(emberMesh);

    // --- Light ---
    const lightIntensity = 1.5;
    const lightDistance = 15;
    const lightDecay = 1.5;
    const pointLight = new THREE.PointLight(
      0xffaa44,
      lightIntensity,
      lightDistance,
      lightDecay
    );
    // PERFORMANCE: plus 100 fps, but shadows are not visible
    // It's okay until I have one campfire.
    // Could range check and activate if player nearby.
    // pointLight.castShadow = true;
    // Shadow setup (optional, can be simplified/removed for placed campfires)
    pointLight.shadow.mapSize.width = 256;
    pointLight.shadow.mapSize.height = 256;
    pointLight.shadow.camera.near = 0.5;
    pointLight.shadow.camera.far = lightDistance;
    pointLight.shadow.bias = -0.01;
    pointLight.position.set(0, 0.5, 0); // Position relative to the group's origin
    pointLight.visible = true; // Start lit (or add logic to light it)
    campfireGroup.add(pointLight); // Add light to the group
    campfireGroup.userData.light = pointLight; // Keep reference if needed
    campfireGroup.name = `Campfire_Object_(${position.x.toFixed(
      1
    )},${position.z.toFixed(1)})`;
    return campfireGroup; // Return the whole group
  }

  _addCampfirePlaceholder(position) {
    // Create the visual object first (at temporary Y)
    const campfireGroup = this.createCampfireObject(
      new THREE.Vector3(position.x, position.y, position.z)
    );
    const pointLight = campfireGroup.userData.light; // Get light from the group

    // Keep light/group separate for static environment setup initially
    this.scene.add(pointLight); // Add light directly for static env lights list
    this.scene.add(campfireGroup); // Add group directly
    campfireGroup.visible = false; // Start hidden
    pointLight.visible = false; // Start hidden

    pointLight.name = `CampfireLight_(${position.x.toFixed(
      1
    )},${position.z.toFixed(1)})`;
    campfireGroup.name = `CampfireMesh_(${position.x.toFixed(
      1
    )},${position.z.toFixed(1)})`;

    this.environmentLights.push(pointLight); // Store light reference
    pointLight.userData.visualMesh = campfireGroup; // Link for finalizing position
    pointLight.userData.intendedXZ = { x: position.x, z: position.z };
  }

  getMoonlight() {
    return this.moonLight;
  }

  getEnvironmentLights() {
    return this.environmentLights;
  }

  _addMoonlight() {
    const initialMoonIntensity = 1.5;
    this.moonLight = new THREE.DirectionalLight(0xaaaaff, initialMoonIntensity); // Cool blue, low intensity
    this.moonLight.position.set(0, 300, -200); // Initial position (will be updated)
    const castMoonShadows =
      (this.performanceProfile.maxShadowCastingLights || 0) > 1;

    this.moonLight.castShadow = castMoonShadows;
    if (castMoonShadows) {
      // Configure shadows (can be lower quality than sun)
      const moonShadowMapSize = Math.max(
        512,
        this.performanceProfile.shadowMapSize / 2
      );
      this.moonLight.shadow.mapSize.width = moonShadowMapSize;
      this.moonLight.shadow.mapSize.height = moonShadowMapSize;
      this.moonLight.shadow.camera.near = 50;
      this.moonLight.shadow.camera.far = 1000;
      // Adjust bounds based on your scene size, maybe tighter than sun's
      const moonBounds = 200;
      this.moonLight.shadow.camera.left = -moonBounds;
      this.moonLight.shadow.camera.right = moonBounds;
      this.moonLight.shadow.camera.top = moonBounds;
      this.moonLight.shadow.camera.bottom = -moonBounds;
      this.moonLight.shadow.bias = -0.001; // Adjust bias
    }
    this.moonLight.visible = false; // Start hidden
    this.moonLight.name = "Moonlight";
    this.scene.add(this.moonLight);
    this.scene.add(this.moonLight.target); // Ensure target is added

    console.log("Moonlight added.");
  }

  _addStars() {
    const starCount = 5000;
    const starGeometry = new THREE.BufferGeometry();
    const positions = [];
    const starRadius = 800; // Make stars distant

    for (let i = 0; i < starCount; i++) {
      // Spherical distribution
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      const x = starRadius * Math.sin(phi) * Math.cos(theta);
      const y = starRadius * Math.sin(phi) * Math.sin(theta);
      const z = starRadius * Math.cos(phi);
      positions.push(x, y, z);
    }

    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const starMaterial = new THREE.PointsMaterial({
      // color: 0xffffff,
      // color: 0xfff9c4,
      color: 0xf7f8ec,
      size: 0.75, // Adjust size
      sizeAttenuation: false, // Stars shouldn't shrink with distance
      depthWrite: false,
      transparent: true, // Optional, if you want fading
      opacity: 0.9, // Optional
      fog: false,
    });

    this.starSystem = new THREE.Points(starGeometry, starMaterial);
    this.starSystem.name = "StarSystem";
    this.starSystem.visible = false; // Start hidden
    this.scene.add(this.starSystem);
    console.log("SceneManager: Star system created.");
  }

  // Add getter for stars
  getStarSystem() {
    return this.starSystem;
  }

  // Optional: Add an update method if clouds need to move/rotate
  updateClouds(delta) {
    this.cloudMeshes.forEach((cloud) => {
      // cloud.position.x += 0.005 * delta;
      // cloud.position.x += 0.5 * delta;
      // Gentle rotation
      // cloud.rotation.y += 0.01 * delta;
    });
  }

  _addClouds() {
    const cloudTexture = new THREE.TextureLoader().load("/textures/cloud2.png"); // << CREATE A CLOUD TEXTURE
    if (!cloudTexture) {
      console.warn("SceneManager: Cloud texture not loaded.");
      // return; // Optionally return if texture fails
    }
    cloudTexture.colorSpace = THREE.SRGBColorSpace; // Ensure correct colorspace if needed

    const cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.8, // Adjust opacity
      depthWrite: false, // Often needed for transparency sorting
      side: THREE.DoubleSide, // Render both sides if needed
      fog: false, // Clouds usually aren't affected by fog
    });

    const cloudCount = 15; // Number of cloud planes
    const cloudSize = 50; // Size of each cloud plane
    const skyRadius = 400; // How far out to place clouds
    const minHeight = 80,
      maxHeight = 120; // Height range

    for (let i = 0; i < cloudCount; i++) {
      const cloudGeometry = new THREE.PlaneGeometry(cloudSize, cloudSize * 0.6); // Adjust aspect ratio
      const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);

      // Random position in the sky cylinder
      const angle = Math.random() * Math.PI * 2;
      const distance = skyRadius * (0.5 + Math.random() * 0.5); // Place between half and full radius
      const height = minHeight + Math.random() * (maxHeight - minHeight);

      cloudMesh.position.set(
        Math.cos(angle) * distance,
        height,
        Math.sin(angle) * distance
      );

      // Make clouds face the center (or camera - requires update loop)
      cloudMesh.lookAt(0, height, 0); // Look towards center horizontally

      cloudMesh.name = `Cloud_${i}`;
      this.scene.add(cloudMesh);
      this.cloudMeshes.push(cloudMesh); // Store reference for movement
    }
    console.log(`SceneManager: Added ${this.cloudMeshes.length} cloud meshes.`);
  }

  /**
   * Adds default lighting (ambient and directional) to the scene.
   * Private helper method.
   */
  _addLights() {
    // Store references when creating lights
    this.ambientLight = new THREE.AmbientLight(
      SCENE_CONFIG.AMBIENT_LIGHT_COLOR,
      SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY
    );
    this.scene.add(this.ambientLight);

    this.sunlight = new THREE.DirectionalLight( // Assign to this.sunlight
      SCENE_CONFIG.SUNLIGHT_COLOR,
      SCENE_CONFIG.SUNLIGHT_INTENSITY
    );
    this.sunlight.position.copy(SCENE_CONFIG.SUNLIGHT_POSITION);
    // --- Apply Shadow Settings from Profile ---
    const castSunShadows =
      (this.performanceProfile.maxShadowCastingLights || 0) > 0;
    this.sunlight.castShadow = castSunShadows;
    if (castSunShadows) {
      this.sunlight.shadow.mapSize.width =
        this.performanceProfile.shadowMapSize;
      this.sunlight.shadow.mapSize.height =
        this.performanceProfile.shadowMapSize;
      this.sunlight.shadow.camera.near = SCENE_CONFIG.SHADOW_CAMERA_NEAR;
      this.sunlight.shadow.camera.far = SCENE_CONFIG.SHADOW_CAMERA_FAR;
      this.sunlight.shadow.camera.left = -SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
      this.sunlight.shadow.camera.right = SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
      this.sunlight.shadow.camera.top = SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
      this.sunlight.shadow.camera.bottom = -SCENE_CONFIG.SHADOW_CAMERA_BOUNDS;
    }
    // Add the class property 'this.sunlight' to the scene
    this.scene.add(this.sunlight);
    this.scene.add(this.sunlight.target); // Add target for directional light

    // Optional: Add shadow helper, using the class property 'this.sunlight'
    // const shadowHelper = new THREE.CameraHelper(this.sunlight.shadow.camera);
    // this.scene.add(shadowHelper);
  }

  // Method to create the visual sun >>>
  _addVisualSun() {
    const sunGeometry = new THREE.SphereGeometry(10, 16, 8); // Adjust size
    // Emissive material makes it glow and ignore scene lights/shadows
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff88, // Yellowish
      // emissive: 0xFFFF88,
      // emissiveIntensity: 1,
      fog: false, // Make sure sun isn't affected by scene fog
    });
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.name = "VisualSun";
    this.sunMesh.castShadow = false; // Visual sun doesn't cast shadows
    this.sunMesh.receiveShadow = false; // Or receive them
    this.sunMesh.visible = false; // Start hidden until positioned by day/night cycle

    this.scene.add(this.sunMesh);
    console.log("SceneManager: Visual sun mesh created.");
  }

  getSunMesh() {
    return this.sunMesh;
  }

  getSunlight() {
    return this.sunlight;
  }

  getAmbientLight() {
    return this.ambientLight;
  }

  /**
   * Adds a simple ground plane to the scene.
   * Private helper method.
   */
  // _addTile() {
  //     const grassGeometry = new THREE.PlaneGeometry(SCENE_CONFIG.GROUND_SIZE, SCENE_CONFIG.GROUND_SIZE);
  //     const grassMaterial = new THREE.MeshLambertMaterial({ color: SCENE_CONFIG.GROUND_COLOR });
  //     const grassTile = new THREE.Mesh(grassGeometry, grassMaterial);
  //     grassTile.rotation.x = -Math.PI / 2;
  //     grassTile.position.set(0, 0, 0);
  //     grassTile.receiveShadow = true;
  //     this.scene.add(grassTile);
  // }

  /**
   * Adds a THREE.Object3D (like a model, light, or group) to the scene.
   * @param {THREE.Object3D} object - The object to add.
   */
  add(object) {
    this.scene.add(object);
  }

  /**
   * Removes a THREE.Object3D from the scene.
   * @param {THREE.Object3D} object - The object to remove.
   */
  remove(object) {
    this.scene.remove(object);
  }

  /**
   * Updates the camera's aspect ratio. Should be called on window resize.
   * @param {number} aspectRatio - The new aspect ratio (width / height).
   */
  updateCameraAspectRatio(aspectRatio) {
    this.camera.aspect = aspectRatio;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Returns the main THREE.Scene instance.
   * @returns {THREE.Scene}
   */
  getScene() {
    return this.scene;
  }

  /**
   * Returns the main THREE.PerspectiveCamera instance.
   * @returns {THREE.PerspectiveCamera}
   */
  getCamera() {
    return this.camera;
  }

  // TODO: Add methods for managing environment maps, fog, etc.
  // TODO: Potentially link objects to physics bodies if SceneManager handles adding complex objects.
  // Example: add(visual, physicsBody) { this.scene.add(visual); this.physicsLinkMap.set(visual, physicsBody); }
  // syncVisualsToPhysics() { /* Iterate map and update visual transforms from physics */ }
}

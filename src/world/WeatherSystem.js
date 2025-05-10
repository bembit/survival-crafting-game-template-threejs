// src/world/WeatherSystem.js
import * as THREE from "three";
import eventBus from "../core/EventBus.js";

// ideally we should control the lights here too.
// like the ambient

// Enum for weather states - ADD NEW TYPES
export const WeatherType = {
  CLEAR: "clear",
  RAIN: "rain", // Visual Only (currently)
  SNOW: "snow", // Visual Only (currently)
  BLIZZARD: "blizzard", // Visual (like snow) + Slow Effect
  FREEZING: "freezing", // Visual (subtle frost?) + Damage Over Time
  // Add more types as needed (e.g., FOG, HEAVY_SNOW)
};

export class WeatherSystem {
  sceneManager;
  camera; // Need camera reference for positioning particles

  particleCount = 10000; // Number of rain/snow particles
  particleSystem = null; // THREE.Points object
  particleGeometry = null; // BufferGeometry
  particleMaterial = null; // PointsMaterial
  particleVelocities = []; // Optional: Store velocities for more complex movement

  spawnBoxSize = new THREE.Vector3(50, 30, 50); // Area above camera where particles spawn
  currentWeather = WeatherType.CLEAR;
  // Store weather intensity/details ---
  weatherDetails = { intensity: 1.0 }; // Intensity (0.0 to 1.0)

  // Textures (Load these once, perhaps via ResourceManager or here)
  // rainTexture = null; // TODO: Load texture
  // snowTexture = null; // TODO: Load texture
  // freezingTexture = null; // TODO: Load texture
  // frostTexture = null; // TODO: Optional texture for freezing effect

  constructor(sceneManager, camera) {
    this.sceneManager = sceneManager;
    this.camera = camera;
    // TODO: Load textures (e.g., using THREE.TextureLoader)
    // this.rainTexture = new THREE.TextureLoader().load('./textures/rain.png');
    // this.snowTexture = new THREE.TextureLoader().load('./textures/snowflake.png');
    // this.freezingTexture = new THREE.TextureLoader().load(
    //   "./textures/freezing.png"
    // );
    console.log("WeatherSystem initialized (Textures need loading).");
  }

  // Call this to change the weather
  setWeather(newWeatherType, details = { intensity: 1.0 }) {
    // Add details parameter
    if (
      this.currentWeather === newWeatherType &&
      JSON.stringify(this.weatherDetails) === JSON.stringify(details)
    )
      return; // Avoid redundant changes

    const oldWeather = this.currentWeather;
    console.log(
      `Weather changing from ${this.currentWeather} to ${newWeatherType} with details:`,
      details
    );
    this.currentWeather = newWeatherType;
    this.weatherDetails = { ...details }; // Store new details

    // --- Emit Event ---
    eventBus.emit("weatherChanged", {
      oldWeather: oldWeather,
      newWeather: this.currentWeather,
      details: this.weatherDetails, // Pass details in event
    });

    // Remove existing particle system if present
    if (this.particleSystem) {
      this.sceneManager.remove(this.particleSystem);
      this.particleGeometry?.dispose();
      this.particleMaterial?.dispose(); // Dispose material if unique per type
      this.particleSystem = null;
      this.particleGeometry = null;
      this.particleMaterial = null;
      this.particleVelocities = [];
    }

    // --- Visual Effect Logic ---
    // Adjust particle count/speed based on intensity?
    const effectiveParticleCount = Math.floor(
      this.particleCount * this.weatherDetails.intensity
    );

    // Create new system based on type
    if (newWeatherType === WeatherType.RAIN) {
      this._createParticles(
        this.rainTexture,
        0.06,
        8.0 * this.weatherDetails.intensity,
        effectiveParticleCount
      ); // Adjust speed/count?
    } else if (newWeatherType === WeatherType.SNOW) {
      this._createParticles(
        this.snowTexture,
        0.11,
        2.0 * this.weatherDetails.intensity,
        effectiveParticleCount
      );
    } else if (newWeatherType === WeatherType.BLIZZARD) {
      // Use snow texture, but maybe denser/faster?
      this._createParticles(
        this.snowTexture,
        0.12,
        4.0 * this.weatherDetails.intensity,
        Math.floor(effectiveParticleCount * 1.5),
        0xd7fefc
      ); // Denser blizzard
    } else if (newWeatherType === WeatherType.FREEZING) {
      this._createParticles(
        this.freezingTexture,
        0.03,
        12.0 * this.weatherDetails.intensity,
        Math.floor(effectiveParticleCount * 1.5)
      );
    }

    // Add particle system to scene if created
    if (this.particleSystem) {
      this.sceneManager.add(this.particleSystem);
    }
  }

  // Internal method to create the particle system - Added count parameter
  _createParticles(texture, size, baseSpeed, count, color) {
    if (count <= 0) return; // Don't create if count is zero

    this.particleGeometry = new THREE.BufferGeometry();
    const positions = [];
    this.particleVelocities = []; // Reset velocities

    for (let i = 0; i < count; i++) {
      // Use the dynamic count
      // Initial random position within spawn box (will be centered later)
      const x = Math.random() * this.spawnBoxSize.x - this.spawnBoxSize.x / 2;
      const y = Math.random() * this.spawnBoxSize.y; // Start within height range
      const z = Math.random() * this.spawnBoxSize.z - this.spawnBoxSize.z / 2;
      positions.push(x, y, z);

      // Store initial downward velocity (with some variance)
      this.particleVelocities.push(
        baseSpeed + (Math.random() - 0.5) * baseSpeed * 0.5
      );
    }

    this.particleGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    // Adjust material opacity based on intensity
    const materialOpacity = 0.2 + 0.6 * this.weatherDetails.intensity; // Scale opacity

    this.particleMaterial = new THREE.PointsMaterial({
      size: size,
      map: texture, // Use the provided texture
      blending: THREE.AdditiveBlending, // Looks good for weather
      depthWrite: false, // Prevent occlusion issues
      transparent: true, // Needed if texture has alpha
      sizeAttenuation: true,
      opacity: materialOpacity, // Use calculated opacity
      color: color || 0xffffff, // Default to white
    });

    this.particleSystem = new THREE.Points(
      this.particleGeometry,
      this.particleMaterial
    );
    this.particleSystem.name = `WeatherParticles_${this.currentWeather}`;
    // Initial position will be set relative to camera in update
    this.particleSystem.visible = true; // Ensure it's visible
  }

  // Update particle positions each frame
  update(delta, cameraPosition) {
    if (
      !this.particleSystem ||
      !this.particleGeometry ||
      !this.camera ||
      !this.particleSystem.visible
    )
      return; // Check visibility

    // Center the particle system volume above the camera
    const systemYOffset = this.spawnBoxSize.y / 2 + 5;
    this.particleSystem.position.set(
      cameraPosition.x,
      cameraPosition.y + systemYOffset,
      cameraPosition.z
    );

    const positions = this.particleGeometry.attributes.position.array;
    const fallLimit = -this.spawnBoxSize.y / 2 - 15;
    const particleCount = this.particleGeometry.attributes.position.count; // Get actual count

    for (let i = 0; i < particleCount; i++) {
      // Use actual count
      const i3 = i * 3;
      // Check if velocity exists for this index (important if count changes)
      const velocity =
        this.particleVelocities[i] !== undefined
          ? this.particleVelocities[i]
          : 1.0; // Default velocity if missing

      // Move particle down
      positions[i3 + 1] -= velocity * delta; // Y coordinate index

      // If particle fell below limit, reset its position to top of spawn box
      if (positions[i3 + 1] < fallLimit) {
        positions[i3] =
          Math.random() * this.spawnBoxSize.x - this.spawnBoxSize.x / 2; // Reset X
        positions[i3 + 1] =
          (Math.random() * this.spawnBoxSize.y) / 2 + this.spawnBoxSize.y / 2; // Reset Y to top half
        positions[i3 + 2] =
          Math.random() * this.spawnBoxSize.z - this.spawnBoxSize.z / 2; // Reset Z
      }
    }

    // Tell Three.js to update the geometry
    this.particleGeometry.attributes.position.needsUpdate = true;
  }

  // --- Getter for current weather ---
  getCurrentWeatherState() {
    return {
      type: this.currentWeather,
      details: this.weatherDetails,
    };
  }
}

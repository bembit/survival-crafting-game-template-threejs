// src/systems/DayNightSystem.js
import * as THREE from "three";
import { SCENE_CONFIG } from "../config/SceneConfig.js"; // For defaults

export class DayNightSystem {
  /** @type {import('./world/SceneManager.js').SceneManager} */
  sceneManager;
  /** @type {import('./world/EnvironmentalEffectsSystem.js').EnvironmentalEffectsSystem} */
  environmentalEffectsSystem;

  // Configuration (passed from Game.js or defaults)
  dayDuration;
  sunDistance;
  baseSunIntensity;
  baseAmbientIntensity;
  baseMoonIntensity;
  baseCloudOpacity; // Store base cloud opacity

  // Internal state
  sunAngle = 0;

  constructor(sceneManager, environmentalEffectsSystem, config = {}) {
    if (!sceneManager || !environmentalEffectsSystem) {
      throw new Error(
        "DayNightSystem requires SceneManager and EnvironmentalEffectsSystem instances."
      );
    }
    this.sceneManager = sceneManager;
    this.environmentalEffectsSystem = environmentalEffectsSystem;

    // --- Get Configuration ---
    this.dayDuration = config.dayDuration ?? 600; // Default 10 minutes
    this.sunDistance = config.sunDistance ?? 300;
    this.baseSunIntensity =
      config.baseSunIntensity ?? SCENE_CONFIG.SUNLIGHT_INTENSITY;
    this.baseAmbientIntensity =
      config.baseAmbientIntensity ?? SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY;
    this.baseMoonIntensity = config.baseMoonIntensity ?? 0.15; // Base intensity for moon
    this.baseCloudOpacity = config.baseCloudOpacity ?? 0.8; // Default cloud opacity

    console.log("DayNightSystem initialized.");
  }

  /**
   * Updates the position and intensity of lights, sky color, and other related visuals.
   * @param {number} gameTime - The current total game time in seconds.
   * @param {number} delta - The time delta since the last frame.
   * @returns {boolean} sunIsUp - Indicates if the sun is currently considered 'up'.
   */
  update(gameTime, delta) {
    let sunIsUp = true; // Default state, will be calculated

    // --- Get Interpolated Effect Values ---
    const lightMultipliers =
      this.environmentalEffectsSystem?.getCurrentLightMultipliers() || {
        sun: 1.0,
        ambient: 1.0,
        moon: 1.0,
      }; // Default if system missing
    const skyColorOverride =
      this.environmentalEffectsSystem?.getCurrentSkyColorOverride(); // Returns THREE.Color or null
    const ambientColorOverride =
      this.environmentalEffectsSystem?.getCurrentAmbientColorOverride(); // Get ambient override

    // --- Get Scene Elements ---
    const sun = this.sceneManager.getSunlight();
    const ambient = this.sceneManager.getAmbientLight();
    const sunMesh = this.sceneManager.getSunMesh();
    const starSystem = this.sceneManager.getStarSystem();
    const cloudMeshes = this.sceneManager.cloudMeshes || [];
    const moonLight = this.sceneManager.getMoonlight();
    const environmentLights = this.sceneManager.getEnvironmentLights() || [];

    if (sun && ambient && sunMesh && moonLight) {
      // --- Base Day/Night Calculations ---
      const cycleProgress = (gameTime % this.dayDuration) / this.dayDuration;
      this.sunAngle = cycleProgress * Math.PI * 2;
      const sunY = Math.sin(this.sunAngle) * this.sunDistance;
      const sunX = Math.cos(this.sunAngle) * this.sunDistance;
      const sunZ = Math.cos(this.sunAngle + Math.PI / 2) * this.sunDistance; // Offset Z for different path
      sunIsUp = sunY > -10; // Determine if sun is generally up

      // Position Sun Light and Mesh
      sun.position.set(sunX, sunY, sunZ);
      sun.target.position.set(0, 0, 0); // Keep sun targeting origin
      sunMesh.position.set(sunX, sunY, sunZ);

      // --- Calculate Base Intensity Factors ---
      const baseSunIntensityFactor = Math.max(0, Math.sin(this.sunAngle)); // 0 (night) to 1 (midday)
      const baseMoonIntensityFactor = Math.max(
        0,
        Math.sin(this.sunAngle + Math.PI)
      ); // Opposite phase, 0 (day) to 1 (midnight)

      // --- Apply Final Light Intensities (Base * Effect Multiplier) ---
      sun.intensity =
        this.baseSunIntensity * baseSunIntensityFactor * lightMultipliers.sun;
      ambient.intensity = this.baseAmbientIntensity * lightMultipliers.ambient; // Ambient intensity driven solely by multiplier now
      moonLight.intensity =
        this.baseMoonIntensity *
        baseMoonIntensityFactor *
        lightMultipliers.moon;

      // --- Update Visibilities ---
      sun.visible = sun.intensity > 0.01;
      sunMesh.visible = sun.visible; // Sync visual sun with light visibility
      moonLight.visible = moonLight.intensity > 0.01;

      // --- Moon Position ---
      const moonAngle = this.sunAngle + Math.PI;
      const moonDistance = this.sunDistance * 0.8;
      moonLight.position.set(
        Math.cos(moonAngle) * moonDistance,
        Math.abs(Math.sin(moonAngle) * moonDistance) + 100, // Keep it high
        Math.sin(moonAngle) * moonDistance // Use sin for Z
      );
      moonLight.target.position.set(0, 0, 0); // Keep moon targeting origin

      // --- Update Moon Shadows ---
      const performanceProfile = this.sceneManager.performanceProfile; // Access profile via SceneManager
      const shouldMoonCastShadows =
        (performanceProfile?.maxShadowCastingLights || 0) > 1 &&
        moonLight.visible &&
        !skyColorOverride; // Check profile stored on sceneManager
      // const shouldMoonCastShadows = true;
      // check with static always on shadows
      if (moonLight.castShadow !== shouldMoonCastShadows) {
        moonLight.castShadow = shouldMoonCastShadows;
        // console.log(`Moonlight castShadow set to: ${shouldMoonCastShadows}`);
      }

      // --- Update Stars ---
      if (starSystem) {
        starSystem.visible =
          sun.intensity < this.baseSunIntensity * 0.1 || !!skyColorOverride;
      }

      // --- Update Clouds ---
      const nightCloudOpacity = 0.15;
      const cloudIntensityFactor = Math.min(
        1.0,
        lightMultipliers.ambient * 1.5
      );
      const currentCloudOpacity =
        THREE.MathUtils.lerp(
          nightCloudOpacity,
          this.baseCloudOpacity,
          baseSunIntensityFactor
        ) * cloudIntensityFactor;
      cloudMeshes.forEach((cloudMesh) => {
        if (cloudMesh.material) {
          cloudMesh.material.opacity = currentCloudOpacity;
        }
      });
      // Update cloud position/rotation if SceneManager doesn't handle it
      // this.sceneManager.updateClouds(delta); // Or call directly if logic is simple

      // --- Update Environment Lights ---
      environmentLights.forEach((light) => {
        const visual = light.userData.visualMesh;
        const shouldBeOn =
          sun.intensity < this.baseSunIntensity * 0.15 || !!skyColorOverride;
        light.visible = shouldBeOn;
        // if (visual) visual.visible = shouldBeOn;
        if (visual) visual.visible = true;
        // if (shouldBeOn && light.visible) {
        //   // const baseIntensity = 1.5; // Base campfire brightness
        //   // reduce flicker intensity. timeout.
        //   // light.intensity = baseIntensity + Math.random() * 0.3 - 0.15; // Flicker
        // }
      });

      // --- Apply Sky Color AND Ambient Color ---
      if (skyColorOverride) {
        // Apply the sky override color
        this.sceneManager.scene.background.copy(skyColorOverride);

        // Apply the AMBIENT override color
        if (ambientColorOverride) {
          ambient.color.copy(ambientColorOverride);
        } else {
          // Fallback if sky is overridden but ambient isn't (e.g., during Fog)
          ambient.color.setHex(0x333340); // Default dim color during override
        }
      } else {
        // --- No Sky Override: Calculate Normal Sky/Ambient Colors ---
        const skyColor = new THREE.Color(SCENE_CONFIG.SKYBOX_COLOR);
        const sunsetColor = new THREE.Color(0xffaa66);
        const nightColor = new THREE.Color(0x050515);
        const moonlitNightColor = new THREE.Color(0x080818);

        // Apply Calculated Background Color
        if (!sunIsUp && moonLight.visible) {
          // Moonlit Night
          this.sceneManager.scene.background.set(moonlitNightColor);
        } else if (sunY < -this.sunDistance * 0.1) {
          // Deep Night
          this.sceneManager.scene.background.set(nightColor);
        } else if (sunY < this.sunDistance * 0.2) {
          // Sunrise/Sunset
          const lerpFactor = Math.min(
            1,
            (sunY + this.sunDistance * 0.1) / (this.sunDistance * 0.3)
          );
          const isSunset =
            Math.sin(this.sunAngle) > 0 && Math.cos(this.sunAngle) < 0;
          const startColor = isSunset ? skyColor : nightColor;
          if (!(this.sceneManager.scene.background instanceof THREE.Color)) {
            this.sceneManager.scene.background = new THREE.Color();
          }
          this.sceneManager.scene.background.lerpColors(
            startColor,
            sunsetColor,
            isSunset ? 1 - lerpFactor : lerpFactor
          );
        } else {
          // Daytime
          this.sceneManager.scene.background.set(skyColor);
        }

        // Apply Calculated Ambient Color (or override if provided)
        if (ambientColorOverride) {
          ambient.color.copy(ambientColorOverride); // Use override if exists (e.g. non-dark effect changing ambient)
        } else {
          // Calculate normal ambient color based on time
          if (!sunIsUp && moonLight.visible) {
            ambient.color.setHex(0x404088);
          } else if (sunY < -this.sunDistance * 0.1) {
            ambient.color.setHex(0x222233);
          } else if (sunY < this.sunDistance * 0.2) {
            ambient.color.setHex(0xaaaaff);
          } else {
            ambient.color.setHex(SCENE_CONFIG.AMBIENT_LIGHT_COLOR);
          }
        }
      }
    } // End if (sun && ambient && ...)

    return sunIsUp; // Return the calculated sun status
  } // End update()
}

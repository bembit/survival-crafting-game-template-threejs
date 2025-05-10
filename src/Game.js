// src/Game.js
import * as THREE from "three";
// Core / Managers
import { InputManager, Actions } from "./core/InputManager.js";
import { SceneManager } from "./world/SceneManager.js";
import { ResourceManager } from "./core/ResourceManager.js";
// World
import { Terrain } from "./world/Terrain.js";
import { GameStateManager } from "./world/GameStateManager.js";
import { InstancedManager } from "./world/InstancedManager.js";
// Controllers
import { CameraController } from "./controllers/CameraController.js";
// Systems
import { AnimationSystem } from "./systems/AnimationSystem.js";
import { PhysicsEngine } from "./physics/PhysicsEngine.js";
import { InteractionSystem } from "./systems/InteractionSystem.js";
import { AbilitySystem } from "./systems/AbilitySystem.js";
import { EnemyManager } from "./systems/EnemyManager.js";
import { AISystem } from "./systems/AISystem.js";
// import { LootSystem } from "./systems/LootSystem.js";
// UI
import { UIManager } from "./ui/UIManager.js";
// Configs
import { RESOURCE_NODE_CONFIGS } from "./config/ResourceConfig.js";
import { SCENE_CONFIG } from "./config/SceneConfig.js";
// Setup Modules
import { createPlayer } from "./setup/PlayerSetup.js";
import { loadStaticAssets } from "./setup/EnvironmentSetup.js";

import { DayNightSystem } from "./world/DayNightSystem.js";
import { WeatherSystem } from "./world/WeatherSystem.js";
import { WeatherType } from "./world/WeatherSystem.js";
import { EnvironmentalEffectsSystem } from "./world/EnvironmentalEffectsSystem.js";
import { EffectType } from "./world/EnvironmentalEffectsSystem.js";

import { EnemySpawner } from "./systems/EnemySpawner.js";
// import { SPAWN_POINTS_CONFIG } from "./config/SpawnPointsConfig.js";

import eventBus from "./core/EventBus.js";

import { CraftingSystem } from "./systems/CraftingSystem.js";
import { ConsumableSystem } from "./systems/ConsumableSystem.js";

// import { WeatherEffectComponent } from "./game/components/WeatherEffectComponent.js";

import { SoundManager } from "./systems/SoundManager.js";

import { PlacementSystem } from "./systems/PlacementSystem.js";

/**
 * The main class that orchestrates the game systems. Initializes necessary components
 * like input, scene, physics, controllers, loads assets, and runs the game loop.
 */

// Define Performance Profiles
const PERFORMANCE_PROFILES = {
  low: {
    shadowMapSize: 1024,
    shadowType: THREE.PCFSoftShadowMap, // Default
    resourceNodeMultiplier: 0.5, // 50% of configured nodes
    spawnerActivationMultiplier: 0.3, // 30% of configured activation range currenetly 100 * 0.3 = 30
    maxShadowCastingLights: 1, // Limit shadow casters -> 0 off. 1 sun On moon off, 2 both on.
  },
  medium: {
    shadowMapSize: 4096, // Default from SceneConfig?
    shadowType: THREE.PCFSoftShadowMap, // Default
    resourceNodeMultiplier: 0.75, // 75% of configured nodes
    spawnerActivationMultiplier: 0.5, // 50% of configured activation range
    maxShadowCastingLights: 2,
  },
  high: {
    shadowMapSize: 8192, // Default from SceneConfig?
    shadowType: THREE.PCFSoftShadowMap,
    resourceNodeMultiplier: 1, // 100% of configured nodes
    spawnerActivationMultiplier: 1, // 100% of configured activation range
    maxShadowCastingLights: 2, // Allow more shadow casters
  },
  ultra: {
    shadowMapSize: 16384, // Default from SceneConfig?
    shadowType: THREE.PCFSoftShadowMap,
    resourceNodeMultiplier: 3, // 300% of configured nodes
    spawnerActivationMultiplier: 1, // 100% of configured activation range
    maxShadowCastingLights: 2, // Allow more shadow casters
  },
  ultra_low: {
    shadowMapSize: 8192, // Default from SceneConfig?
    shadowType: THREE.PCFSoftShadowMap,
    resourceNodeMultiplier: 3, // 300% of configured nodes
    spawnerActivationMultiplier: 0.5, // 100% of configured activation range
    maxShadowCastingLights: 2, // Allow more shadow casters
  },
  // ultra low ai
  brick: {
    shadowMapSize: 16384, // Default from SceneConfig?
    shadowType: THREE.PCFSoftShadowMap,
    resourceNodeMultiplier: 3, // 300% of configured nodes
    spawnerActivationMultiplier: 3, // 300% of configured activation range
    maxShadowCastingLights: 2, // Allow more shadow casters
  },
};

// move to config
const CAMPFIRE_WARMTH_RADIUS = 5.0; // <<< Define warmth radius ()
const CAMPFIRE_WARMTH_RADIUS_SQ =
  CAMPFIRE_WARMTH_RADIUS * CAMPFIRE_WARMTH_RADIUS; // Use squared distance for efficiency

export class Game {
  // New Systems

  isGameOver = false;

  enemyManager = null;
  aiSystem = null;

  playerController = null;
  playerSpawnPosition = null;

  // <<< Day/Night Cycle Properties >>>
  dayDuration = 520; // How many real-world seconds for one full game day/night cycle
  // gameTime = (5 / 24) * this.dayDuration;
  gameTime = 0; // Total elapsed game time in seconds
  // sunAngle = 0; // Current angle of the sun
  // sunDistance = 300; // How far the sun position is from the center ()
  // baseSunIntensity = SCENE_CONFIG.SUNLIGHT_INTENSITY; // Store base intensity
  // baseAmbientIntensity = SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY; // Store base ambient intensity
  // baseCloudOpacity = 0.8; // The default opacity in SceneManager._addClouds
  // baseMoonIntensity = 0.15; // Store base intensity for moon

  dayNightSystem = null;

  weatherSystem = null;
  weatherChangeIntervalHours = 3; // How often to change weather (in game hours)
  weatherChangeIntervalSeconds = 0; // Calculated interval in game seconds
  lastWeatherChangeTime = 0; // Game time when weather last changed automatically
  availableWeatherTypes = [
    WeatherType.CLEAR,
    WeatherType.RAIN,
    // same as blizzard without negative effects. turned off for now.
    // WeatherType.SNOW,
    WeatherType.BLIZZARD,
    WeatherType.FREEZING,
  ]; // Array of possible types

  // gamestate base
  gameStateManager = null;
  isLoadingFromSave = false;
  environmentSeed = null; // Store the seed for the current game session
  loadedDepletedNodeIds = new Set();

  /** @type {Set<string>} Stores instance IDs of nodes that should never respawn. */
  permanentlyDepletedNodeIds = new Set();

  interactionSystem = null;

  enemyManager = null;

  enemySpawner = null;

  craftingSystem = null;
  consumableSystem = null;

  placementSystem = null;

  soundManager = null;
  currentBgmState = null; // e.g., 'day', 'night', 'combat', 'none'

  // <<< FPS Counter Properties >>>
  fpsCounterElement = null; // Reference to the UI element
  fpsLastUpdateTime = 0; // Time of the last FPS update
  fpsUpdateInterval = 0.5; // Update FPS display every 0.5 seconds
  frameCount = 0; // Frames counted since last update
  currentFps = 0; // Calculated FPS value

  performanceProfile = null; // Store the selected profile
  dynamicResourceConfigs = []; // Store adjusted resource counts

  environmentalEffectsSystem = null;

  constructor(settings = { detail: "medium" }) {
    console.log("Game Initializing with settings:", settings);
    this.performanceProfile =
      PERFORMANCE_PROFILES[settings.detail] || PERFORMANCE_PROFILES.medium;
    console.log("Using Performance Profile:", this.performanceProfile);

    this.clock = new THREE.Clock();
    this.isRunning = false;
    /** @type {{x: number, y: number, z: number} | null} Calculated player spawn position */
    this.playerSpawnPosition = null;

    // --- Core Systems Initialization ---
    this.canvas = document.getElementById("canvas");
    if (!this.canvas)
      throw new Error("Canvas element with ID 'canvas' not found!");

    this.inputManager = new InputManager(this.canvas);
    this.resourceManager = new ResourceManager();

    // --- Renderer Setup ---
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: this.performanceProfile.detail !== "low", // Antialias except on low?
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.performanceProfile.shadowType;

    // this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // --- Game Systems / World ---
    this.animationSystem = new AnimationSystem();
    this.physicsEngine = null; // Init AFTER Ammo load
    this.interactionSystem = null;
    this.uiManager = null;
    this.terrain = null;
    this.instancedManager = null;

    // // TEMPORARY: Add weather system
    // this.weatherSystem = new WeatherSystem(
    //   this.sceneManager,
    //   this.sceneManager.getCamera()
    // );

    // <<< Temporary: Add key listener to change weather for testing >>>
    window.addEventListener("keydown", (event) => {
      if (!this.weatherSystem) return;
      if (event.code === "Digit5")
        this.weatherSystem.setWeather(WeatherType.CLEAR);
      if (event.code === "Digit6")
        this.weatherSystem.setWeather(WeatherType.RAIN);
      if (event.code === "Digit7")
        this.weatherSystem.setWeather(WeatherType.SNOW);
      if (event.code === "Digit8")
        this.weatherSystem.setWeather(WeatherType.BLIZZARD);
      if (event.code === "Digit9")
        this.weatherSystem.setWeather(WeatherType.FREEZING);
    });

    // Add key listener for mute toggle here or in initGame
    this.addMuteKeyListener(); //
    // plus mute

    // END TEMPORARY

    // --- Controllers / Player ---
    this.cameraController = new CameraController(
      // this.sceneManager.getCamera(),
      this.inputManager
    );

    // --- Abilities ---
    this.abilityComponent = null;

    // --- Game State Manager ---
    this.environmentSeed = null; // Initialize seed

    this.tempPlayerPos = new THREE.Vector3(); // Add temporary vector to avoid allocation in loop
    this.tempCampfirePos = new THREE.Vector3(); // Add temporary vector

    this._prepareDynamicResourceConfigs(); // Call helper here

    // --- Start Async Initialization ---
    this.initGame();

    // --- Event Listeners ---
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
  }

  // <<< HELPER METHOD >>>
  _prepareDynamicResourceConfigs() {
    const multiplier = this.performanceProfile.resourceNodeMultiplier;
    this.dynamicResourceConfigs = RESOURCE_NODE_CONFIGS.map((config) => {
      // Create a shallow copy to avoid modifying original config
      const newConfig = { ...config };
      if (typeof newConfig.count === "number") {
        // Modify count based on multiplier, ensure it's an integer >= 0
        newConfig.count = Math.max(0, Math.floor(newConfig.count * multiplier));
      }
      return newConfig;
    });
    console.log(
      "Dynamic resource counts prepared:",
      this.dynamicResourceConfigs.map((c) => `${c.id}: ${c.count}`)
    );
  }

  /** Reloads the game - useful for applying loaded state or starting fresh */
  reloadGame() {
    console.log("Reloading game...");
    window.location.reload();
  }

  /**
   * Asynchronously initializes Physics (Ammo.js), assets, terrain, instances, and sets up the game.
   */
  async initGame() {
    try {
      console.log("Waiting for Ammo.js physics engine...");
      await Ammo();
      console.log("Ammo.js Initialized.");

      eventBus.on("playerDied", this.handlePlayerDeath.bind(this));
      console.log("Game: Subscribed to 'playerDied' event.");

      // --- Initialize Core Systems (Physics, UI, GameState Manager, Sounds ..) ---
      this.physicsEngine = new PhysicsEngine();
      this.uiManager = new UIManager(this, this.physicsEngine);
      this.gameStateManager = new GameStateManager(this);
      this.sceneManager = new SceneManager(
        this.physicsEngine,
        this.performanceProfile
      );

      this.physicsEngine.setSceneReference(this.sceneManager.getScene());

      this.soundManager = new SoundManager(this.sceneManager.getCamera(), this); // <<< Instantiate SoundManager
      // --- Load Sounds (Asynchronously) ---
      // Start loading sounds early, but don't await here to avoid blocking init
      this.soundManager
        .loadSounds()
        .then(() => {
          console.log("Background sound loading process finished.");
          // Initial sounds will start automatically if context is already resumed
        })
        .catch((err) => {
          console.error("Error during background sound loading:", err);
        });
      // --- End load sounds ---

      // <<< Get or create FPS counter element after UI Manager init >>>
      this.fpsCounterElement = this.uiManager.createFpsCounterElement();

      // <<< 'P' Key Listener after physicsEngine is valid >>>
      window.addEventListener("keydown", (event) => {
        if (event.code === "KeyP") {
          console.log("'P' key pressed, attempting to toggle debug...");
          this.physicsEngine?.toggleDebug(); // Use optional chaining just in case
        }
      });
      console.log("Debug toggle 'P' key listener added."); // Confirm listener setup

      // --- 1. Check for Save Data & Determine Seed/Load State ---
      let loadedData = null;
      this.isLoadingFromSave = false; // Reset flags
      this.environmentSeed = null;
      this.loadedDepletedNodeIds.clear();
      this.permanentlyDepletedNodeIds.clear(); // Clear persistent set

      console.log("Checking for save data...");
      if (this.gameStateManager.hasSaveData()) {
        loadedData = this.gameStateManager.loadGameDataFromStorage();
        if (loadedData) {
          // Valid save found
          this.isLoadingFromSave = true;
          this.environmentSeed = loadedData.world.environmentSeed; // Get seed from save
          this.gameTime = loadedData.world.gameTime || 0; // Get time from save
          // Initialize the persistent set from the loaded data
          this.permanentlyDepletedNodeIds = new Set( // Initialize persistent set
            loadedData.world?.permanentlyDepletedNodeIds || [] // Use new property name
          );
          // Keep the old logic ONLY for initial node skipping during generation
          this.loadedDepletedNodeIds = new Set(this.permanentlyDepletedNodeIds); // Copy for compatibility with InstancedManager
          console.log(
            `%cLOADING SAVE. Using Seed: [${this.environmentSeed}], Loaded ${this.permanentlyDepletedNodeIds.size} permanently depleted nodes.`,
            "color: red; font-weight: bold;"
          );
          this.uiManager?.log(`Loading saved game...`);
        } else {
          console.log("Save data invalid/incompatible. Starting new game.");
        }
      } else {
        console.log("No save data found. Starting new game.");
      }

      // If not loading (new game or load failed), generate a new seed NOW
      if (!this.isLoadingFromSave) {
        this.environmentSeed = Math.random().toString(36).substring(2, 15);
        this.gameTime = 0; // Reset time for new game
        console.log(
          `%cNEW GAME. Generated Seed: [${this.environmentSeed}]`,
          "color: red; font-weight: bold;"
        );
        this.uiManager?.log(`Starting new game...`);
        this.uiManager?.showChatBubble(
          "Feels very cold here. I should try to find some warm clothes. Maybe start a fire?",
          10000
        );
      }

      // --- Sanity check: Seed must be set by now ---
      if (this.environmentSeed === null || this.environmentSeed === undefined) {
        throw new Error(
          "Environment seed is null/undefined before initializing world!"
        );
      }

      // temporary pos to test.
      this.weatherSystem = new WeatherSystem(
        this.sceneManager,
        this.sceneManager.getCamera()
      );

      // --- 2. Initialize Remaining Systems (Instances needed for world gen) ---
      // Create instances AFTER determining seed and load state
      this.terrain = new Terrain(this.sceneManager, this.physicsEngine);
      this.instancedManager = new InstancedManager(
        this.sceneManager,
        this.physicsEngine,
        this.resourceManager
      );
      this.interactionSystem = new InteractionSystem(
        this.physicsEngine,
        this.instancedManager,
        this.sceneManager,
        this.uiManager,
        this.resourceManager,
        this, // pass game instance to interact sys
        this.soundManager // <<< PASS SOUND MANAGER
      );
      this.abilitySystem = new AbilitySystem(
        this.physicsEngine,
        this.sceneManager,
        this.uiManager
      );
      this.aiSystem = new AISystem(this.physicsEngine, this.uiManager);
      this.enemyManager = new EnemyManager(
        this.resourceManager,
        this.physicsEngine,
        this.sceneManager,
        this.animationSystem,
        this.aiSystem,
        this.uiManager,
        this.interactionSystem,
        this // <<< Pass reference to Game instance
      );
      this.cameraController = new CameraController(
        this.sceneManager.getCamera(),
        this.inputManager
      );

      this.craftingSystem = new CraftingSystem(this); // <<< Instantiate

      this.placementSystem = new PlacementSystem(this); // <<< Instantiate Placement System

      this.consumableSystem = new ConsumableSystem(this); // <<< Instantiate

      // if (!this.weatherSystem) {
      //   // Initialize if not already done
      //   this.weatherSystem = new WeatherSystem(
      //     this.sceneManager,
      //     this.sceneManager.getCamera()
      //   );
      // }

      // <<< Instantiate EnvironmentalEffectsSystem >>>
      this.environmentalEffectsSystem = new EnvironmentalEffectsSystem(
        this.sceneManager,
        this.enemyManager, // Pass enemyManager if needed for Blood Moon event handling (alternative to direct component access)
        this.environmentSeed // Use the determined seed, might disable
      );

      // --->>> Instantiate DayNightSystem <<<---
      this.dayNightSystem = new DayNightSystem(
        this.sceneManager,
        this.environmentalEffectsSystem,
        {
          // Pass configuration
          dayDuration: this.dayDuration,
          sunDistance: 300, // Or get from config/Game property if needed
          baseSunIntensity: SCENE_CONFIG.SUNLIGHT_INTENSITY,
          baseAmbientIntensity: SCENE_CONFIG.AMBIENT_LIGHT_INTENSITY,
          baseMoonIntensity: 0.15, // Your previous value
          baseCloudOpacity: 0.8, // Your previous value
        }
      );
      // --->>> End Instantiation <<<---

      // --- Initialize Enemy Spawner AFTER managers it needs ---
      this.enemySpawner = new EnemySpawner( // <<< Instantiate Spawner
        this.enemyManager,
        this.physicsEngine,
        this, // Pass Game instance
        this.performanceProfile.spawnerActivationMultiplier // <<< Pass multiplier for performance settings
      );
      // DEBUG LOG
      console.log("Enemy Spawner instance after creation:", this.enemySpawner);

      // --- 3. Generate World Content (Terrain FIRST) ---
      // This uses the seed determined in step 1 (loaded or new)
      this.uiManager?.log(
        `Generating terrain using seed: ${this.environmentSeed}`
      );
      this.terrain.generate({
        size: 400,
        segments: 200,
        maxHeight: 8,
        seed: this.environmentSeed,
      });
      this.uiManager?.log("Terrain generated.");

      this.sceneManager._addEnvironmentLights();

      // --- Finalize Environment Light Positions ---
      if (
        this.sceneManager &&
        typeof this.sceneManager.finalizeEnvironmentPositions === "function"
      ) {
        this.uiManager?.log("Setting final campfire positions...");
        this.sceneManager.finalizeEnvironmentPositions(); // This should now work
        this.uiManager?.log("Campfire positions set.");
      } else {
        console.error(
          "Cannot finalize environment positions: SceneManager or method missing."
        );
      }

      // --- Initialize Spawners AFTER Terrain ---
      // DEBUG LOG
      console.log(
        "Checking Enemy Spawner right before initializeSpawners:",
        this.enemySpawner
      );
      if (!this.enemySpawner) {
        console.error(
          "!!! Enemy Spawner is NULL/UNDEFINED right before calling initializeSpawners !!!"
        );
      }
      // --- Initialize Spawners AFTER Terrain ---
      this.enemySpawner.initializeSpawners();
      this.uiManager?.log("Enemy spawners initialized.");

      // --- 4. Generate Instanced Nodes (Trees, Rocks) ---
      // --- Generate Instanced Nodes (Use dynamic counts) ---
      this.uiManager?.log("Creating instanced nodes (density adjusted)...");
      await Promise.all(
        // Use the pre-calculated dynamicResourceConfigs
        this.dynamicResourceConfigs.map((config) =>
          this.instancedManager.createNodes(
            config, // Pass the config with adjusted count
            this.environmentSeed,
            this.isLoadingFromSave ? this.loadedDepletedNodeIds : new Set()
          )
        )
      );
      this.uiManager?.log("Instanced nodes created.");

      // --- 5. Create Player ---
      this.uiManager?.log("Creating player...");
      const playerDeps = {
        /* ... dependencies ... */ resourceManager: this.resourceManager,
        physicsEngine: this.physicsEngine,
        sceneManager: this.sceneManager,
        animationSystem: this.animationSystem,
        inputManager: this.inputManager,
        uiManager: this.uiManager,
        soundManager: this.soundManager,
      };
      const playerSetupResult = await createPlayer(playerDeps);
      if (!playerSetupResult || !playerSetupResult.playerController) {
        throw new Error("Player creation failed.");
      }
      this.playerController = playerSetupResult.playerController;
      this.playerSpawnPosition = playerSetupResult.spawnPosition; // Store default spawn

      // --- 6. Set Player References ---
      if (this.playerController?.player) {
        this.cameraController.setPlayer(this.playerController.player);
        this.interactionSystem?.setPlayerReference(
          this.playerController.player
        );
        this.aiSystem?.setPlayerReference(this.playerController.player);
      } else {
        throw new Error("Failed to set player references.");
      }

      // Reset player near campfire flag
      if (this.playerController?.player) {
        this.playerController.player.userData.isNearCampfire = false;
      }

      // --- 7. Load Static Assets ---
      this.uiManager?.log("Loading static environment assets...");
      const envDeps = {
        resourceManager: this.resourceManager,
        physicsEngine: this.physicsEngine,
        sceneManager: this.sceneManager,
        animationSystem: this.animationSystem,
      };
      await loadStaticAssets(envDeps);
      this.uiManager?.log("Static assets loaded.");

      // --- 8. Final State Application / Spawning ---
      if (this.isLoadingFromSave && loadedData) {
        // Apply loaded player transform, health, inventory, etc.
        console.log("Applying loaded game state details...");
        this.gameStateManager.applyCoreLoadedState(loadedData); // Sets transform

        // HERE
        // --- Apply Player Stats (Level, XP)
        this.gameStateManager.applyPlayerStatsState(loadedData);
        // --- Apply Player Inventory & Health
        this.gameStateManager.applyPlayerComponentState(loadedData);
        // --- END Apply Stats
        // Apply loaded equipment state
        this.gameStateManager.applyPlayerEquipmentState(loadedData);
        // this.gameStateManager.applyFinalPlayerHealthState(loadedData); // Applies health based on final maxHealth
        // --- Aplly Skill Tree
        this.gameStateManager.applyPlayerSkillTreeState(loadedData); // Applies skill ranks & effects, then recalculates stats

        // Update equipment UI too
        const playerEquipment =
          this.playerController?.player?.userData?.equipment;
        if (playerEquipment && this.uiManager) {
          this.uiManager.updateCharacterSheet(playerEquipment); // Update sheet display
        }

        // --- Initial UI Update for Loaded State ---
        const playerStats = this.playerController?.player?.userData?.stats;
        if (playerStats && this.uiManager) {
          console.log("[Game.initGame] Updating UI Bar with loaded stats...");
          this.uiManager.updateXpBar(
            playerStats.level,
            playerStats.currentXP,
            playerStats.xpToNextLevel
          );
          // Update other UI
        }

        // TODO: Implement applyExtendedLoadedState in GameStateManager if needed for health, inv, etc.
        // await this.gameStateManager.applyExtendedLoadedState(loadedData);
        // --- Spawn Loaded Loot Items
        this.uiManager?.log("Spawning saved loot items...");
        if (this.interactionSystem && loadedData.world?.activeLoot) {
          await this.interactionSystem.spawnLoadedLoot(
            loadedData.world.activeLoot
          );
        } else {
          console.warn(
            "Could not spawn loaded loot: InteractionSystem or loot data missing."
          );
        }
        this.uiManager?.log("Saved loot items spawned.");
        // extra enemies on load

        // TODO: Spawn loaded enemies, loot
        // await this.enemyManager.spawnLoadedEnemies(loadedData.enemies);
        // await this.interactionSystem.spawnLoadedLoot(loadedData.world.activeLoot);
        this.uiManager?.log("Saved game state applied.");
      } else {
        // New Game: Position player at default spawn
        this.uiManager?.log("Positioning player for new game...");
        this.resetPlayerPosition(true); // Force use of playerSpawnPosition
        // --- Initial UI Update for New Game State
        const playerStats = this.playerController?.player?.userData?.stats;
        if (playerStats && this.uiManager) {
          console.log("[Game.initGame] Updating UI Bar with new game stats...");
          this.uiManager.updateXpBar(
            playerStats.level,
            playerStats.currentXP,
            playerStats.xpToNextLevel
          );

          const playerInv = this.playerController.player.userData?.inventory;

          if (playerInv)
            eventBus.emit("inventoryChanged", { inventory: playerInv });
          // Update other UI like health bar if needed
        }
        // --- END Initial UI Update

        // TODO: Spawn default enemies
        // Might add extra spawns on reload just not as many?
        // TODO: Spawn default enemies for a new game
        console.log("Spawning initial enemies (new game)...");
        // ... your default enemy spawning logic ...
      }

      // --- Final UI Update After Load/New Game ---
      const finalPlayerStats = this.playerController?.player?.userData?.stats;
      const finalPlayerHealth = this.playerController?.player?.userData?.health;
      const finalPlayerEquipment =
        this.playerController?.player?.userData?.equipment;

      if (finalPlayerStats && finalPlayerHealth && this.uiManager) {
        console.log(
          "[Game.initGame] Final explicit UI update for player stats/health."
        );
        this.uiManager.updateXpBar(
          finalPlayerStats.level,
          finalPlayerStats.currentXP,
          finalPlayerStats.xpToNextLevel
        );
        // Ensure player health bar is updated with the correct values
        this.uiManager.updatePlayerHealthBar(
          finalPlayerHealth.currentHealth,
          finalPlayerHealth.maxHealth // Use the final maxHealth from the health component
        );
        if (finalPlayerEquipment)
          this.uiManager.updateCharacterSheet(finalPlayerEquipment); // Update equipment sheet if visible
        this.uiManager.updateCharacterStatsDisplay(); // Update stats display
      }
      // --- End Final UI Update ---

      // Calculate weather change interval in game seconds
      this.weatherChangeIntervalSeconds =
        (this.weatherChangeIntervalHours / 24) * this.dayDuration;
      // Reset last change time based on loaded/initial game time
      this.lastWeatherChangeTime = this.gameTime;

      // --- Add Blood Moon Listener ---
      eventBus.on("effectStarted", (data) => {
        if (data.effectType === EffectType.BLOOD_MOON && data.config) {
          this._applyBloodMoonEffect(data.config.damageMultiplier);
        }
      });
      eventBus.on("effectEnded", (data) => {
        if (data.effectType === EffectType.BLOOD_MOON) {
          this._removeBloodMoonEffect();
        }
      });
      // --- End Blood Moon Listener ---

      // --- Finalize ---
      console.log(
        `Final Check - Seed: [${this.environmentSeed}], isLoad: ${this.isLoadingFromSave}`
      );
      this.uiManager?.log("Initialization Complete. Starting Game Loop.");
      this.isRunning = true;
      this.animate(); // Start the loop
    } catch (error) {
      console.error("Initialization failed:", error);
      this.uiManager?.log(`ERROR: Initialization failed - ${error.message}`);
      document.body.innerHTML = `<div style="color: red; padding: 20px;">Error initializing game: ${error.message}. Check console.</div>`; // Init error display
    }
  }

  // --- Blood Moon Application/Removal Helpers ---
  _applyBloodMoonEffect(multiplier) {
    console.log(
      `Applying Blood Moon Effect (Damage x${multiplier}) to all enemies...`
    );
    this.uiManager?.log("A Blood Moon rises... Enemies grow stronger!", "red");
    // this.enemyManager?.activeEnemies.forEach((enemyInfo) => {
    //   const statsComp = enemyInfo.model?.userData?.stats;
    //   if (statsComp instanceof StatsComponent) {
    //     // Check type
    //     statsComp.applyModifier(
    //       "damage",
    //       multiplier,
    //       Infinity,
    //       "blood_moon_buff",
    //       "multiplicative"
    //     );
    //   }
    // });
    // TODO: Apply to newly spawned enemies in EnemyManager.spawnEnemy?
    // This needs a flag in Game or EnemyManager to check when spawning.
    this.isBloodMoonActive = true; // TBI
    this.bloodMoonMultiplier = multiplier; // TBI
  }

  _removeBloodMoonEffect() {
    console.log("Removing Blood Moon Effect...");
    this.uiManager?.log("The Blood Moon fades...", "lightblue");
    this.isBloodMoonActive = false;
    this.bloodMoonMultiplier = 1.0;
    // this.enemyManager?.activeEnemies.forEach((enemyInfo) => {
    //   const statsComp = enemyInfo.model?.userData?.stats;
    //   if (statsComp instanceof StatsComponent) {
    //     // Check type
    //     statsComp.removeModifierById("blood_moon_buff");
    //   }
    // });
  }

  // --- Mute Key Listener Setup ---
  addMuteKeyListener() {
    //
    window.addEventListener("keydown", (event) => {
      //
      if (event.code === "KeyM") {
        // 'M' key for Mute/Unmute
        console.log("[Game] M key pressed, toggling mute..."); //
        this.soundManager?.toggleMute();
      }
    });
    console.log("[Game] Mute toggle 'M' key listener added."); //
  }
  // --- END Mute Key Listener Setup ---

  // --- Method to Handle Player Death ---
  handlePlayerDeath(eventData) {
    // console.error(
    //   `[Game.handlePlayerDeath] Handler triggered! Current isGameOver flag: ${this.isGameOver}`
    // );

    if (this.isGameOver) return; // Prevent running multiple times

    console.log("%cGAME OVER detected!", "color: red; font-size: 1.5em;");
    this.isGameOver = true;
    // Optional: Stop physics/AI updates more forcefully? Setting the flag should suffice.
    // this.isRunning = false; // Or just use isGameOver flag in animate()

    // Trigger the UI change via UIManager
    this.uiManager?.showGameOverScreen();

    // You might want to disable player input here too
    // this.inputManager?.disableInput(); // Could be implemented.
  }

  /**
   * Adjusts the current game time by a specified number of hours.
   * @param {number} hours - The number of hours to add (positive) or subtract (negative).
   */
  adjustGameTime(hours) {
    if (typeof hours !== "number" || !this.dayDuration) return;

    const timeAdjustmentSeconds = (hours * this.dayDuration) / 24.0;
    this.gameTime += timeAdjustmentSeconds;

    // Optional: Handle negative time wrap-around if desired
    // If gameTime goes below zero, wrap it around the dayDuration
    // while (this.gameTime < 0) {
    //     this.gameTime += this.dayDuration;
    // }
    // Or just clamp at 0 if negative time isn't meaningful
    this.gameTime = Math.max(0, this.gameTime);

    // Log the change
    const newTimeHours =
      ((this.gameTime % this.dayDuration) / this.dayDuration) * 24;
    console.log(
      `Adjusted time by ${hours} hrs. New gameTime: ${this.gameTime.toFixed(
        2
      )}s (approx Hour ${Math.floor(newTimeHours)})`
    );
    this.uiManager?.log(`Time adjusted by ${hours} hr(s).`);

    // Force immediate UI clock update (optional, animate loop will catch it too)
    if (this.uiManager) {
      this.uiManager.updateGameClock(this.gameTime, this.dayDuration);
    }
  }

  // --- Add Save/Load Triggers ---
  triggerSaveGame() {
    if (this.gameStateManager && this.isRunning) {
      // Check if running
      this.gameStateManager.saveGame();
    } else {
      this.uiManager?.log(
        "Cannot save: GameStateManager not ready or game not running."
      );
    }
  }

  triggerLoadGame() {
    // Reload the application to ensure a clean state
    this.uiManager?.log("Reloading game to load save...");
    this.isGameOver = false; // Reset flag before reloading
    this.reloadGame();
  }

  triggerNewGame() {
    if (this.gameStateManager) {
      this.isGameOver = false; // Reset flag before reloading
      this.gameStateManager.newGame(); // Clears save and reloads
    } else {
      // Fallback if manager not ready? Unlikely scenario if called from UI post-init
      console.warn("Cannot start new game: GameStateManager not ready.");
      this.reloadGame(); // Simple reload as fallback
    }
  }

  resetPlayerPosition(forceDefault = false) {
    /* ensure it uses playerSpawnPosition correctly if forceDefault is true */
    let targetPosition = forceDefault ? this.playerSpawnPosition : null;
    let targetRotation = { x: 0, y: 0, z: 0, w: 1 };

    if (!targetPosition && this.isLoadingFromSave && this.gameStateManager) {
      const loadedPlayerState =
        this.gameStateManager.loadGameDataFromStorage()?.player;
      if (loadedPlayerState?.position) {
        targetPosition = loadedPlayerState.position;
        targetRotation = loadedPlayerState.rotation || targetRotation;
      }
    }
    // Fallback to default spawn if still no target position
    if (!targetPosition) targetPosition = this.playerSpawnPosition;

    // ... rest of the checks and setBodyTransform call ...
    if (
      !this.playerController ||
      !this.playerController.physicsBody ||
      !this.physicsEngine ||
      !targetPosition
    ) {
      console.warn(
        "Cannot reset player position: Dependencies or target position missing."
      );
      return;
    }
    const body = this.playerController.physicsBody;
    const bodyHalfHeight = body.userData?.bodyHalfHeight;
    if (bodyHalfHeight === undefined) {
      console.error("Cannot reset player: Body half-height missing.");
      return;
    }
    // Assume targetPosition is the FEET position
    const targetCenterPos = {
      x: targetPosition.x,
      y: targetPosition.y + bodyHalfHeight,
      z: targetPosition.z,
    };
    this.physicsEngine.setBodyTransform(body, targetCenterPos, targetRotation);
    this.playerController.isJumping = false;
    this.uiManager?.log("Player position reset.");
  }

  // Method removed, refactoring.

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.sceneManager.updateCameraAspectRatio(width / height);
    if (this.uiManager) this.uiManager.onResize();
  }

  /** The main game loop */
  animate() {
    // --- Check Game Over Flag at the start of the loop ---
    if (this.isGameOver) {
      // Optional: Allow minimal updates like camera or UI fade effects?
      // For now, just render and exit.
      this.renderer.render(
        this.sceneManager.getScene(),
        this.sceneManager.getCamera()
      );
      return; // Stop most game logic updates
    }
    // --- End Game Over Check ---

    if (!this.isRunning) return; //
    requestAnimationFrame(this.animate.bind(this)); //
    const delta = this.clock.getDelta(); //

    const elapsedTime = this.clock.getElapsedTime(); // Get total elapsed time

    this.gameTime += delta; //

    const currentDay = Math.floor(this.gameTime / this.dayDuration) + 1;

    // --- FPS Calculation ---
    this.frameCount++;
    if (elapsedTime >= this.fpsLastUpdateTime + this.fpsUpdateInterval) {
      this.currentFps = Math.round(
        this.frameCount / (elapsedTime - this.fpsLastUpdateTime)
      );
      this.frameCount = 0;
      this.fpsLastUpdateTime = elapsedTime;

      // Update the UI element via UIManager
      if (this.uiManager && this.fpsCounterElement) {
        this.uiManager.updateFpsCounter(
          this.fpsCounterElement,
          this.currentFps
        );
      }
    }
    // --- END FPS Calculation ---

    // --- Automatic Weather Change Check ---
    if (this.weatherSystem && this.weatherChangeIntervalSeconds > 0) {
      if (
        this.gameTime - this.lastWeatherChangeTime >=
        this.weatherChangeIntervalSeconds
      ) {
        this.lastWeatherChangeTime = this.gameTime; // Reset timer

        // Select a random weather type
        const randomIndex = Math.floor(
          Math.random() * this.availableWeatherTypes.length
        );
        const nextWeather = this.availableWeatherTypes[randomIndex];

        console.log(
          `Weather Check: Time interval passed. Setting weather to: ${nextWeather}`
        );
        this.uiManager?.log(`Weather changing to ${nextWeather}...`);
        this.weatherSystem.setWeather(nextWeather);
      }
    }
    // --- End Weather Check Block ---

    // --- Proximity Checks (e.g., Campfire Warmth) ---
    let isPlayerWarmed = false;
    if (this.playerController?.player && this.placementSystem) {
      this.playerController.player.getWorldPosition(this.tempPlayerPos); // Use temp vector
      const campfires = this.placementSystem.getActiveCampfires();

      for (const campfire of campfires) {
        // Use the stored position for distance check
        this.tempCampfirePos.copy(campfire.position);
        const distanceSq = this.tempPlayerPos.distanceToSquared(
          this.tempCampfirePos
        );

        if (distanceSq < CAMPFIRE_WARMTH_RADIUS_SQ) {
          isPlayerWarmed = true;
          break; // Found a nearby campfire, no need to check others
        }
      }
      // Update the flag on the player's userData
      this.playerController.player.userData.isNearCampfire = isPlayerWarmed;
    }
    // --- End Proximity Check Block ---

    // --- Update Weather System (Particles) --- <<< Ensure this runs *after* potential setWeather call
    if (this.weatherSystem) {
      const cameraPosition = this.sceneManager
        .getCamera()
        .getWorldPosition(new THREE.Vector3());
      this.weatherSystem.update(delta, cameraPosition);
    }

    // --->>> DAY/NIGHT SYSTEM <<<---
    let sunIsUp = true; // Default, will be updated by the system
    if (this.dayNightSystem) {
      sunIsUp = this.dayNightSystem.update(this.gameTime, delta); // Update and get sun status
    }

    // --- Update Environmental Effects ---
    this.environmentalEffectsSystem?.update(delta, !sunIsUp);

    // This should be just an event. No need to check for sound in render.
    // --- BGM State Management ---
    // --- Readiness checks ---
    if (
      this.soundManager &&
      this.soundManager.isInitialized &&
      this.soundManager.isLoadingComplete
    ) {
      // <<< Check if soundManager is ready //
      let desiredBgmState = null;
      // TODO: Add combat detection logic here

      if (!desiredBgmState) {
        desiredBgmState = sunIsUp ? "day" : "night"; //
      }

      // Check if state needs to change
      if (desiredBgmState !== this.currentBgmState) {
        //
        console.log(
          `[Game BGM] State changed from ${this.currentBgmState} to ${desiredBgmState}`
        ); //
        this.currentBgmState = desiredBgmState; //

        // Select and start the appropriate track
        let bgmIdToPlay = null;
        switch (
          this.currentBgmState //
        ) {
          case "day":
            bgmIdToPlay = "bgm_explore_day";
            break; //
          case "night":
            bgmIdToPlay = "bgm_explore_night";
            break; //
          // case 'combat': bgmIdToPlay = 'bgm_combat'; break; //
          default:
            bgmIdToPlay = "bgm_explore_day";
            break; //
        }

        if (bgmIdToPlay) {
          this.soundManager.startBGM(bgmIdToPlay); //
        }
      }
    }
    // --- End BGM Block ---

    // --- Update Clouds ---
    // Call the cloud update method if it exists in SceneManager
    if (
      this.sceneManager &&
      typeof this.sceneManager.updateClouds === "function"
    ) {
      this.sceneManager.updateClouds(delta);
      // console.log(
      //   `%cDoing clouds.`,
      //   "color: red; font-weight: bold;"
      // );
    }

    // // --- ***** Toggle Player Torch based on Light Level ***** ---
    // if (this.playerController?.player) {
    //   // Check if player exists
    //   const playerModel = this.playerController.player;
    //   const torchLight = playerModel.userData.torchLight; // Get torch reference

    //   if (torchLight) {
    //     // Check if torch exists
    //     const torchNightThreshold = 0.25; // Sun intensity factor below which torch turns on
    //     if (currentSunIntensityFactor < torchNightThreshold) {
    //       torchLight.visible = true; // Turn ON at night
    //     } else {
    //       torchLight.visible = false; // Turn OFF during day
    //     }
    //   }
    // }
    // // --- ***** END Toggle Player Torch ***** ---

    if (this.interactionSystem) this.interactionSystem.update(delta);

    if (this.playerController && this.playerController.player) {
      // Add check for player object
      const playerAbilityComp =
        this.playerController.player.userData?.abilityComponent;
      // --- Use 'stats' to access the component --- V
      const playerStatsComp = this.playerController.player.userData?.stats;
      // --- Use 'stats' to access the component --- ^

      // --- Get Weather Effect Component ---
      const playerWeatherComp =
        this.playerController.player.userData?.weatherEffect; // Use the key assigned in PlayerSetup

      // Update Components that need frame updates
      playerAbilityComp?.updateCooldowns(delta);

      // Now call updateModifiers (still use optional chaining initially just in case)
      playerStatsComp?.updateModifiers(delta); // <<< UPDATE BUFFS

      // --- Update Weather Effect Component ---
      playerWeatherComp?.update(delta); // Call update for DOT timers

      this.playerController.update(delta); // Update controller logic LAST? Or does it need updated stats first? (Usually needs updated stats)
    }

    // --- Check for Inventory Toggle Input ---
    if (this.inputManager.wasActionTriggered(Actions.TOGGLE_INVENTORY)) {
      this.uiManager?.toggleInventoryDisplay();
    }
    // --- End Inventory Toggle Check ---

    // --- Check for Character Sheet Toggle Input ---
    if (this.inputManager.wasActionTriggered(Actions.TOGGLE_CHARACTER_SHEET)) {
      this.uiManager?.toggleCharacterSheet();
    }
    // --- End Character Sheet Toggle Check ---

    // --- Update Order ---
    // 1. Input (Handled by listeners)
    // 2. Logic/Controllers
    if (this.playerController) this.playerController.update(delta);
    if (this.interactionSystem) this.interactionSystem.update(delta);
    if (this.abilitySystem) this.abilitySystem.update(delta); // <<< UPDATE ABILITY SYSTEM (for projectiles/timed effects)

    // if (this.aiSystem) this.aiSystem.update(delta); // <<< UPDATE AI SYSTEM

    // Check if the aiSystem instance exists before calling update
    if (this.aiSystem) {
      // console.log("Calling aiSystem.update..."); // <<< Log right before the call
      this.aiSystem.update(delta);
    } else {
      // console.log("Skipping aiSystem.update (instance is null/undefined)"); // <<< See if this logs
    }

    if (this.enemySpawner) this.enemySpawner.update(delta); // <<< UPDATE Spawner

    // <<< --- DEBUG LOGS --- >>>
    // console.log("--- Game Loop: Checking System Updates ---");
    // console.log(`this.aiSystem exists: ${!!this.aiSystem}`);
    // <<< --- DEBUG LOGS --- >>>

    // 3. Physics
    if (this.physicsEngine) this.physicsEngine.update(delta);
    // 4. Animation
    this.animationSystem.update(delta);
    // 5. Camera (Pass delta for smoothing)
    if (this.cameraController) this.cameraController.update(delta); // <<< Pass Delta
    // 6. UI Update
    if (this.uiManager) {
      this.uiManager.updateGameClock(
        this.gameTime,
        this.dayDuration,
        currentDay
      );
      this.uiManager.update(/* game state */);
    }
    // 7. Render
    this.renderer.render(
      this.sceneManager.getScene(),
      this.sceneManager.getCamera()
    );

    // 8. Input Reset
    this.inputManager.resetFrameState();
  }

  // TODO: Add destroy method for cleanup
  destroy() {
    this.isRunning = false;
    // destroy other systems
    this.soundManager?.destroy();
  }
} // End Game Class

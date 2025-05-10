// src/systems/EnemySpawner.js
import * as THREE from "three";
import { SPAWN_POINTS_CONFIG } from "../config/SpawnPointsConfig.js";
import { getEnemyData } from "../config/EnemiesConfig.js";
import eventBus from "../core/EventBus.js";

export class EnemySpawner {
  /** @type {import('./EnemyManager.js').EnemyManager} */
  enemyManager;
  /** @type {import('../physics/PhysicsEngine.js').PhysicsEngine} */
  physicsEngine;
  /** @type {import('../Game.js').Game} */ // Need Game reference for player access
  gameInstance;

  spawners = []; // Array to hold state for each configured spawner
  playerPos = new THREE.Vector3(); // Reusable vector

  activationMultiplier = 1.0; // Store the multiplier

  constructor(
    enemyManager,
    physicsEngine,
    gameInstance,
    activationMultiplier = 1.0
  ) {
    this.enemyManager = enemyManager;
    this.physicsEngine = physicsEngine;
    this.gameInstance = gameInstance;

    this.activationMultiplier = activationMultiplier; // <<< Store multiplier

    if (!this.enemyManager || !this.physicsEngine || !this.gameInstance) {
      console.error("EnemySpawner: Missing required manager references!");
      return;
    }

    // Listen for enemy deaths to update spawner counts
    eventBus.on("enemyDied", this.handleEnemyDeath.bind(this));

    console.log(
      `EnemySpawner initialized with Activation Multiplier: ${this.activationMultiplier}`
    );

    console.log("EnemySpawner initialized.");
  }

  /**
   * Reads the config, calculates ground positions, and sets initial state.
   * Call this *after* the terrain has been generated.
   */
  initializeSpawners() {
    console.log("Initializing enemy spawners...");
    this.spawners = []; // Clear existing state if re-initializing

    SPAWN_POINTS_CONFIG.forEach((config) => {
      const groundY = this.physicsEngine.getHeightAt(
        config.position.x,
        config.position.z
      );
      if (groundY === null) {
        console.warn(
          `EnemySpawner: Could not get terrain height for spawner "${config.id}". Skipping.`
        );
        return;
      }

      // Store runtime state for this spawner
      this.spawners.push({
        config: config, // Reference to original config
        centerPosition: new THREE.Vector3(
          config.position.x,
          groundY,
          config.position.z
        ),
        activeSpawnedEnemies: new Set(), // Store instance IDs spawned by *this* spawner
        respawnTimer: 0, // Timer for respawning delay
        isActive: false, // Is the player currently within activation range?
        totalWeight: config.spawnList.reduce(
          (sum, item) => sum + item.weight,
          0
        ), // Pre-calculate total weight
      });
    });
    console.log(
      `Initialized ${this.spawners.length} enemy spawner configurations.`
    );
  }

  /**
   * Main update loop, checks spawners and triggers spawns if conditions met.
   * @param {number} delta - Time since last frame.
   */
  update(delta) {
    const player = this.gameInstance?.playerController?.player;
    if (!player || this.spawners.length === 0) {
      return; // Need player position and configured spawners
    }

    player.getWorldPosition(this.playerPos);

    this.spawners.forEach((spawner) => {
      const distSq = this.playerPos.distanceToSquared(spawner.centerPosition);
      // --- Apply Multiplier to Activation Radius ---
      const adjustedActivationRadius =
        spawner.config.activationRadius * this.activationMultiplier;
      const activationRadiusSq =
        adjustedActivationRadius * adjustedActivationRadius;

      // Activation Check (uses adjusted radius now)
      const shouldBeActive = distSq <= activationRadiusSq;

      if (shouldBeActive && !spawner.isActive) {
        // Player entered activation radius - trigger initial spawns
        console.log(`Spawner "${spawner.config.id}" activated.`);
        spawner.isActive = true;
        this._tryInitialSpawn(spawner);
        spawner.respawnTimer = spawner.config.respawnDelaySeconds; // Start timer after activation
      } else if (!shouldBeActive && spawner.isActive) {
        // Player left activation radius
        console.log(`Spawner "${spawner.config.id}" deactivated.`);
        spawner.isActive = false;
        // Optional: Despawn enemies immediately? Or let them wander/return?
        // For simplicity, let AI handle wandering back or despawning if too far.
        spawner.respawnTimer = 0; // Reset timer when inactive
      }

      // --- Spawning Logic (Only if active) ---
      if (spawner.isActive) {
        // Decrement timer
        if (spawner.respawnTimer > 0) {
          spawner.respawnTimer -= delta;
        }

        // Check if ready to spawn (timer done AND below max count)
        if (
          spawner.respawnTimer <= 0 &&
          spawner.activeSpawnedEnemies.size < spawner.config.maxEnemies
        ) {
          this._trySpawnEnemy(spawner);
          spawner.respawnTimer = spawner.config.respawnDelaySeconds; // Reset timer after spawn attempt
        }
      }
    });
  }

  /** Attempts the initial spawn burst for an activated spawner */
  _tryInitialSpawn(spawner) {
    const needed = Math.max(
      0,
      spawner.config.initialSpawnCount - spawner.activeSpawnedEnemies.size
    );
    console.log(
      `Spawner "${spawner.config.id}": Initial spawn - needing ${needed}`
    );
    for (let i = 0; i < needed; i++) {
      if (spawner.activeSpawnedEnemies.size >= spawner.config.maxEnemies) break; // Safety check
      this._trySpawnEnemy(spawner);
    }
  }

  /** Attempts to spawn a single enemy for a given spawner */
  async _trySpawnEnemy(spawner) {
    if (spawner.totalWeight <= 0) return; // No valid enemies to spawn

    let chosenEnemyId = null;
    const randomWeight = Math.random() * spawner.totalWeight;
    let weightSum = 0;
    for (const spawnInfo of spawner.config.spawnList) {
      weightSum += spawnInfo.weight;
      if (randomWeight <= weightSum) {
        chosenEnemyId = spawnInfo.enemyId;
        break;
      }
    }

    if (!chosenEnemyId || !getEnemyData(chosenEnemyId)) {
      console.error(
        `Spawner "${spawner.config.id}": Invalid enemyId selected or missing data.`
      );
      return;
    }

    // --- Calculate Spawn Position ---
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spawner.config.radius;
    const spawnX = spawner.centerPosition.x + Math.cos(angle) * radius;
    const spawnZ = spawner.centerPosition.z + Math.sin(angle) * radius;
    const spawnY = this.physicsEngine.getHeightAt(spawnX, spawnZ); // Use actual terrain height from physicsEngine
    console.log(
      `[Spawner <span class="math-inline">\{spawner\.config\.id\}\] Attempting spawn at X\:</span>{spawnX.toFixed(1)}, Z:${spawnZ.toFixed(
        1
      )}. Terrain Y: ${spawnY === null ? "NULL" : spawnY.toFixed(2)}`
    );
    if (spawnY === null) {
      console.warn(`... Ground height check failed. Spawn aborted.`);
      return;
    }

    if (spawnY === null) {
      console.warn(
        `Spawner "${
          spawner.config.id
        }": Could not find valid ground position at (${spawnX.toFixed(
          1
        )}, ${spawnZ.toFixed(1)}). Spawn aborted.`
      );
      return; // Don't spawn if ground height isn't found
    }
    const spawnPosition = { x: spawnX, y: spawnY, z: spawnZ }; // Y is ground level here

    // --- Spawn via EnemyManager ---
    console.log(
      `Spawner "${spawner.config.id}": Attempting to spawn ${chosenEnemyId} at`,
      spawnPosition
    );
    const instanceId = await this.enemyManager.spawnEnemy(
      chosenEnemyId,
      spawnPosition
    );

    if (instanceId) {
      spawner.activeSpawnedEnemies.add(instanceId);
      // Optional: Add spawnerId to the enemy's userData for tracking death
      const enemyInfo = this.enemyManager.activeEnemies.get(instanceId);
      if (enemyInfo?.model) {
        enemyInfo.model.userData.spawnerId = spawner.config.id;
      }
      console.log(
        `Spawner "${spawner.config.id}": Spawned ${instanceId} (${chosenEnemyId}). Active: ${spawner.activeSpawnedEnemies.size}/${spawner.config.maxEnemies}`
      );
    } else {
      console.error(
        `Spawner "${spawner.config.id}": Failed to spawn ${chosenEnemyId}.`
      );
      // Optional: Don't reset timer if spawn failed? Or add a small delay?
    }
  }

  /** Handles enemy death to decrement spawner count */
  handleEnemyDeath(eventData) {
    const instanceId = eventData?.instanceId;
    if (!instanceId) return;

    // Find which spawner (if any) this enemy belonged to
    this.spawners.forEach((spawner) => {
      if (spawner.activeSpawnedEnemies.has(instanceId)) {
        spawner.activeSpawnedEnemies.delete(instanceId);
        console.log(
          `Spawner "${spawner.config.id}": Enemy ${instanceId} died. Active: ${spawner.activeSpawnedEnemies.size}/${spawner.config.maxEnemies}`
        );
        // Optional: Start respawn timer sooner if desired
        // if (spawner.respawnTimer > spawner.config.respawnDelaySeconds * 0.5) {
        //     spawner.respawnTimer = spawner.config.respawnDelaySeconds * 0.5;
        // }
        return; // Exit loop once found
      }
    });
  }

  // TODO: Add cleanup method (e.g., clear spawners, remove listeners)
  destroy() {
    eventBus.off("enemyDied", this.handleEnemyDeath.bind(this));
    this.spawners = [];
    console.log("EnemySpawner destroyed.");
  }
}

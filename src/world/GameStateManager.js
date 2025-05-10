// src/world/GameStateManager.js
import eventBus from "../core/EventBus.js";
import { getItemData } from "../config/ItemConfig.js";

// Define the structure for save data, including the environment seed
// and the new permanently depleted node list
const defaultSaveData = {
  saveVersion: 1.9, // <<< Increment version
  saveTimestamp: null,
  player: {
    position: { x: 0, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    level: 1,
    currentXP: 0,
    baseMaxHealth: 100, // Keep base health
    currentHealth: 100,
    maxHealth: 100, // Keep calculated max health (might reflect buffs)
    inventory: [],
    equipment: {}, //  equipment state (object mapping slot:itemId)
    skillTree: { skillRanks: {} }, //  default skill tree state
  },
  world: {
    environmentSeed: null,
    gameTime: 0,
    permanentlyDepletedNodeIds: [],
    activeLoot: [],
  },
};

const SAVE_SLOT_KEY = "myGameSaveSlot_v1.9"; // <<< Update save key

export class GameStateManager {
  /** @type {import('../Game.js').Game} */
  gameInstance = null;
  /** @type {import('../ui/UIManager.js').UIManager} */
  uiManager = null;
  /** @type {import('../physics/PhysicsEngine.js').PhysicsEngine | null} */
  physicsEngine = null;

  constructor(gameInstance) {
    this.gameInstance = gameInstance;
    // Get references from the gameInstance
    this.uiManager = gameInstance.uiManager;
    this.physicsEngine = gameInstance.physicsEngine;
  }

  /** Checks if save data exists in storage */
  hasSaveData() {
    return localStorage.getItem(SAVE_SLOT_KEY) !== null;
  }

  /** Creates a deep copy of the default save data */
  getNewGameData() {
    return structuredClone(defaultSaveData);
  }

  /** Loads game data structure from local storage */
  loadGameDataFromStorage() {
    const jsonString = localStorage.getItem(SAVE_SLOT_KEY);
    if (!jsonString) return null;
    try {
      const loadedData = JSON.parse(jsonString);
      // --- Version Check ---
      if (loadedData?.saveVersion !== defaultSaveData.saveVersion) {
        console.warn(
          `Save version mismatch! Expected ${defaultSaveData.saveVersion}, found ${loadedData?.saveVersion}. Discarding save.`
        );
        localStorage.removeItem(SAVE_SLOT_KEY); // Discard old version
        return null;
      }
      // --- Add safety check for essential nested structures ---
      if (!loadedData.player) loadedData.player = {};
      if (!loadedData.world) loadedData.world = {};
      if (!loadedData.player.skillTree)
        loadedData.player.skillTree = { skillRanks: {} }; // Default if missing
      if (!loadedData.player.equipment) loadedData.player.equipment = {}; // Default if missing
      if (!loadedData.player.inventory) loadedData.player.inventory = []; // Default if missing
      if (!loadedData.world.permanentlyDepletedNodeIds)
        loadedData.world.permanentlyDepletedNodeIds = [];
      if (!loadedData.world.activeLoot) loadedData.world.activeLoot = [];

      console.log(
        "Save game data loaded successfully (v",
        loadedData.saveVersion,
        ")."
      );
      return loadedData;
    } catch (error) {
      console.error("Error parsing save data:", error);
      localStorage.removeItem(SAVE_SLOT_KEY);
      return null;
    }
  }

  /** Saves the current game state to local storage */
  saveGame() {
    if (!this.gameInstance || !this.gameInstance.isRunning) {
      this.uiManager?.log(
        "Cannot save game - Game not fully initialized or running."
      );
      return;
    }

    this.uiManager?.log("Saving game...");
    const currentSaveData = this.gatherCurrentState();
    if (!currentSaveData) {
      this.uiManager?.log("Error gathering game state for saving!");
      return;
    }

    currentSaveData.saveTimestamp = Date.now();
    try {
      const jsonString = JSON.stringify(currentSaveData);
      localStorage.setItem(SAVE_SLOT_KEY, jsonString);
      console.log("Game Saved!");
      this.uiManager?.log("Game Saved.");
    } catch (error) {
      console.error("Error saving game:", error);
      this.uiManager?.log("Error saving game!");
    }
  }

  /** Explicitly starts a new game, clearing any existing save */
  newGame() {
    console.log("Starting New Game: Clearing save data...");
    localStorage.removeItem(SAVE_SLOT_KEY);
    this.uiManager?.log("Starting New Game.");
    // Potentially trigger a game reload or state reset via the Game instance
    this.gameInstance?.reloadGame(); // Assuming Game.js has a reload method
  }

  /** Collects the current state from all relevant game systems/components */
  gatherCurrentState() {
    console.log("[GatherState] Gathering current game state...");
    const state = this.getNewGameData();
    const player = this.gameInstance.playerController?.player;
    const playerBody = this.gameInstance.playerController?.physicsBody;
    const playerStats = player?.userData?.stats; // Get stats component
    const playerEquipment = player?.userData?.equipment; // <<< Get Equipment Component
    const playerSkillTree = player?.userData?.skillTree; // <<< GET Skill Tree

    // --- Player Transform ---
    if (playerBody && this.physicsEngine) {
      /* ... set state.player.position/rotation ... */
      const transform = this.physicsEngine.tempTransform;
      const motionState = playerBody.getMotionState();
      if (motionState) {
        motionState.getWorldTransform(transform);
      } else {
        playerBody.getWorldTransform(transform);
      }
      const position = transform.getOrigin();
      const rotation = transform.getRotation();
      state.player.position = {
        x: position.x(),
        y: position.y(),
        z: position.z(),
      };
      state.player.rotation = {
        x: rotation.x(),
        y: rotation.y(),
        z: rotation.z(),
        w: rotation.w(),
      };
    } else {
      console.error("[GatherState] Failed player transform.");
      return null;
    }

    // --- Player Level/XP ---
    if (playerStats) {
      state.player.level = playerStats.level; // <<< SAVE Level
      state.player.currentXP = playerStats.currentXP; // <<< SAVE XP
      state.player.baseMaxHealth = playerStats.baseMaxHealth; // <<< SAVE baseMaxHealth
      state.player.availableSkillPoints = playerStats.availableSkillPoints; // <<< SAVE Skill Points
      console.log(
        `[GatherState] Player Level: ${state.player.level}, XP: ${state.player.currentXP}, BaseMaxHealth: ${state.player.baseMaxHealth} gathered.`
      );
    } else {
      console.warn(
        "[GatherState] Player StatsComponent not found for saving Level/XP/BaseHealth."
      );
      state.player.baseMaxHealth = defaultSaveData.player.baseMaxHealth; // Save default if missing
    }

    // --- Player Health --- (Ensure stats are recalculated before reading currentMaxHealth)
    const playerHealth = player?.userData?.health;
    if (playerStats && playerHealth) {
      playerStats.recalculateCurrentStats(); // Recalculate based on current base stats
      state.player.maxHealth = playerStats.currentMaxHealth; // Save derived current max health
      state.player.currentHealth = playerHealth.currentHealth;
      console.log(
        `%c[GatherState] Health gathered:${state.player.currentHealth} - ${state.player.maxHealth} (Base: ${playerStats.baseMaxHealth})`,
        "color: green; font-weight: bold;"
      );
    } else {
      console.warn(
        "[GatherState] Player HealthComponent or StatsComponent not found for saving Health."
      );
      // Use defaults from getNewGameData if components are missing
      state.player.maxHealth = defaultSaveData.player.maxHealth;
      state.player.currentHealth = defaultSaveData.player.currentHealth;
    }
    // --- End Player Health ---

    // // --- Player Inventory --- ED
    const playerInventory = player.userData?.inventory;

    // --- Player Equipment (Save this first) ---
    let equippedState = {};
    if (
      playerEquipment &&
      typeof playerEquipment.getEquippedItemsState === "function"
    ) {
      equippedState = playerEquipment.getEquippedItemsState();
      state.player.equipment = equippedState; // Save equipment map {slot: itemId}
      console.log(`[GatherState] Equipment gathered:`, state.player.equipment);
    } else {
      console.warn("[GatherState] Player EquipmentComponent not found.");
      state.player.equipment = {};
    }

    // --- Player Inventory (Save Combined Inventory + Equipped Items) ---
    let combinedInventory = [];
    if (playerInventory && Array.isArray(playerInventory.items)) {
      // Start with a deep clone of current inventory items
      combinedInventory = playerInventory.items.map((stack) => ({
        itemId: stack.itemId,
        quantity: stack.quantity,
        item: { id: stack.item.id, name: stack.item.name }, // Basic data
      }));
      console.log(
        `[GatherState] Base inventory has ${combinedInventory.length} stacks.`
      );
    } else {
      console.warn("[GatherState] Player InventoryComponent not found.");
    }

    // Add equipped items back into the list to be saved
    // Note: This simple approach assumes equipped items don't stack with inventory items.
    // If stacking is needed, merge quantities instead of just pushing.
    console.log(`[GatherState] Adding equipped items back for saving...`);
    for (const slot in equippedState) {
      const equippedItemId = equippedState[slot];
      if (equippedItemId) {
        const itemData = getItemData(equippedItemId); // Use config function
        if (itemData) {
          // Check if a stack already exists to potentially merge (optional, complex)
          // const existingStack = combinedInventory.find(s => s.itemId === equippedItemId);
          // if (existingStack && itemData.maxStack > 1) {
          //      existingStack.quantity += 1;
          // } else {
          // Add as a new stack (simpler, common for equipment)
          combinedInventory.push({
            itemId: equippedItemId,
            quantity: 1,
            item: { id: itemData.id, name: itemData.name },
          });
          console.log(
            ` ---> Added equipped item ${equippedItemId} to save list.`
          );
          // }
        } else {
          console.warn(
            `[GatherState] Could not find item data for equipped item ${equippedItemId}`
          );
        }
      }
    }

    state.player.inventory = combinedInventory; // Save the combined list
    console.log(
      `[GatherState] Combined Inventory saved: ${state.player.inventory.length} stacks total.`
    );
    // --- End Player Inventory ---

    // --- Player Skill Tree ---
    if (
      playerSkillTree &&
      typeof playerSkillTree.getSkillTreeState === "function"
    ) {
      state.player.skillTree = playerSkillTree.getSkillTreeState();
      console.log(`[GatherState] Skill Tree gathered:`, state.player.skillTree);
    } else {
      console.warn(
        "[GatherState] Player SkillTreeComponent or getSkillTreeState method not found."
      );
      state.player.skillTree = { skillRanks: {} }; // Save default empty state
    }
    // --- End Skill Tree ---

    // --- World State ---
    state.world.environmentSeed = this.gameInstance.environmentSeed;
    state.world.gameTime = this.gameInstance.gameTime;

    // --- Gather Permanently Depleted Node IDs *** ---
    // Directly get the IDs from the Game instance's Set and convert to Array
    if (this.gameInstance.permanentlyDepletedNodeIds instanceof Set) {
      state.world.permanentlyDepletedNodeIds = Array.from(
        this.gameInstance.permanentlyDepletedNodeIds
      );
      console.log(
        `[GatherState] Permanently depleted nodes gathered: ${state.world.permanentlyDepletedNodeIds.length}`
      );
    } else {
      console.warn(
        "[GatherState] Game instance or permanentlyDepletedNodeIds Set not found!"
      );
      state.world.permanentlyDepletedNodeIds = []; // Save empty array if missing
    }
    // --- *** End Gather Permanently Depleted Nodes *** ---

    // ... (gather active loot) ...
    state.world.activeLoot = [];
    if (this.gameInstance.interactionSystem?.collectableItems) {
      /* ... populate active loot ... */
      this.gameInstance.interactionSystem.collectableItems.forEach(
        (lootBody) => {
          if (lootBody?.userData?.lootComponent && lootBody?.getMotionState()) {
            const transform = this.physicsEngine.tempTransform;
            lootBody.getMotionState().getWorldTransform(transform);
            const position = transform.getOrigin();
            const rotation = transform.getRotation();
            const lootComp = lootBody.userData.lootComponent;
            state.world.activeLoot.push({
              itemId: lootComp.itemId,
              quantity: lootComp.quantity,
              position: { x: position.x(), y: position.y(), z: position.z() },
              rotation: {
                x: rotation.x(),
                y: rotation.y(),
                z: rotation.z(),
                w: rotation.w(),
              },
              modelPath: lootBody.userData.modelPath || null,
            });
          }
        }
      );
    }

    console.log("[GatherState] Finished gathering state.");
    return state;
  }

  /**
   * Applies the loaded game state related to player position and environment seed.
   * Other states (inventory, enemies) will be handled separately or in later steps.
   * @param {object} loadedData - The game state data loaded from storage.
   */
  /** Applies core loaded state (transform, time, seed) */
  applyCoreLoadedState(loadedData) {
    if (!loadedData || !this.physicsEngine || !this.gameInstance) {
      return;
    }
    console.log(
      "[ApplyLoad] Applying core loaded game state (Transform, Time, Seed)..."
    );
    this.gameInstance.gameTime = loadedData.world.gameTime || 0;
    this.gameInstance.environmentSeed = loadedData.world.environmentSeed;
    const playerBody = this.gameInstance.playerController?.physicsBody;
    if (
      playerBody &&
      loadedData.player?.position &&
      loadedData.player?.rotation
    ) {
      this.physicsEngine.setBodyTransform(
        playerBody,
        loadedData.player.position,
        loadedData.player.rotation
      );
    }
    // Do NOT emit event here yet, wait until all state is applied
  }

  applyPlayerStatsState(loadedData) {
    if (!loadedData?.player || !this.gameInstance?.playerController?.player) {
      console.warn(
        "[ApplyStats] Cannot apply player stats: Missing loaded data or player object."
      );
      return;
    }
    console.log(
      "[ApplyStats] Applying loaded player stats (Level, XP, BaseHealth)..."
    ); // Update log

    const playerStats =
      this.gameInstance.playerController.player.userData.stats;
    if (playerStats) {
      playerStats.level =
        loadedData.player.level ?? defaultSaveData.player.level;
      playerStats.currentXP =
        loadedData.player.currentXP ?? defaultSaveData.player.currentXP;
      playerStats.baseMaxHealth =
        loadedData.player.baseMaxHealth ?? defaultSaveData.player.baseMaxHealth; // <<< RESTORE baseMaxHealth
      playerStats.availableSkillPoints =
        loadedData.player.availableSkillPoints ??
        defaultSaveData.player.availableSkillPoints; // <<< LOAD Skill Points

      playerStats.xpToNextLevel = playerStats.calculateXpToNextLevel(
        playerStats.level
      );

      // CRITICAL: Recalculate stats *after* restoring level AND baseMaxHealth
      playerStats.recalculateCurrentStats();

      console.log(
        `[ApplyStats] Applied Level: ${playerStats.level}, XP: <span class="math-inline">\{playerStats\.currentXP\}/</span>{playerStats.xpToNextLevel}, BaseMaxHealth: ${playerStats.baseMaxHealth}` // Update log
      );
      console.log(
        `[ApplyStats] Recalculated currentMaxHealth: ${playerStats.currentMaxHealth}`
      );
    } else {
      console.error(
        "[ApplyStats] Player StatsComponent not found during state application!"
      );
    }
  }

  applyPlayerComponentState(loadedData) {
    if (!loadedData?.player || !this.gameInstance?.playerController?.player) {
      console.warn(
        "[ApplyComponents] Cannot apply player component state: Missing loaded data or player object."
      );
      return;
    }
    const player = this.gameInstance.playerController.player;
    console.log(
      "[ApplyComponents] Applying loaded player inventory & health..."
    );

    // --- Apply Health ---
    const playerStats = player.userData?.stats; // Get stats again for finalized maxHealth
    const playerHealth = player.userData?.health;
    if (playerHealth && playerStats) {
      // Restore max health FIRST from the recalculated STATS component
      playerHealth.maxHealth = playerStats.currentMaxHealth; // <<< USE STATS MAX HEALTH

      // Then restore current health, ensuring it doesn't exceed the restored max
      const savedHealth =
        loadedData.player.currentHealth ?? playerHealth.maxHealth; // Default to new max if missing
      playerHealth.currentHealth = Math.max(
        0, // Allow 0 health
        Math.min(playerHealth.maxHealth, savedHealth)
      );
      console.log(
        // Apply color to the console log for debugging
        `%c[ApplyComponents] Applied Health: ${playerHealth.currentHealth} / ${playerHealth.maxHealth}.`,
        "color: red; font-weight: bold;"
      );
      // <<< EMIT EVENT FOR UI
      eventBus.emit("playerHealthChanged", {
        target: player,
        healthComponent: playerHealth,
      });
    } else {
      console.warn(
        "[ApplyComponents] Player HealthComponent or StatsComponent not found during load."
      );
    }

    // --- Apply Inventory ---
    const playerInventory = player.userData?.inventory;
    if (
      playerInventory && // Check 1: Player has inventory component
      Array.isArray(playerInventory.items) && // Check 2: Its 'items' property IS an Array
      Array.isArray(loadedData.player.inventory) // Check 3: The loaded data IS an Array
    ) {
      playerInventory.items = []; // Clear the existing array
      try {
        loadedData.player.inventory.forEach((stackData) => {
          if (
            stackData &&
            stackData.itemId &&
            typeof stackData.quantity === "number"
          ) {
            // Reconstruct the stack object - ensure 'item' object is recreated if needed
            playerInventory.items.push({
              itemId: stackData.itemId,
              quantity: stackData.quantity,
              item: stackData.item || {
                id: stackData.itemId,
                name: stackData.itemId,
              }, // Use saved basic data
            });
          } else {
            console.warn(
              `[ApplyComponents] Invalid inventory stack data found in save:`,
              stackData
            );
          }
        });
        console.log(
          `[ApplyComponents] Applied Inventory: ${playerInventory.items.size} item stacks loaded.`
        );
        console.log(
          `[ApplyComponents] Inventory AFTER load: ${playerInventory.items.length} stacks.`
        ); // Log count after

        playerInventory.recalculateWeight();
        // *************************

        // --- IMPORTANT: Notify UI after loading ---
        eventBus.emit("inventoryChanged", { inventory: playerInventory });
      } catch (error) {
        console.error(
          "[ApplyComponents] Error applying loaded inventory:",
          error
        );
        playerInventory.items.clear(); // Clear potentially corrupted inventory
      }
    } else {
      console.warn(
        "[ApplyComponents] Player InventoryComponent or saved inventory data not found/invalid during load."
      );
    }
  }

  applyPlayerSkillTreeState(loadedData) {
    if (
      !loadedData?.player?.skillTree ||
      !this.gameInstance?.playerController?.player
    ) {
      console.warn(
        "[ApplySkills] Cannot apply skill tree state: Missing loaded data or player object."
      );
      return;
    }
    const playerSkillTree =
      this.gameInstance.playerController.player.userData?.skillTree;
    const playerStats =
      this.gameInstance.playerController.player.userData?.stats; // Need stats ref for effect application

    if (
      playerSkillTree &&
      typeof playerSkillTree.applySkillTreeState === "function" &&
      playerStats
    ) {
      console.log("[ApplySkills] Applying loaded skill tree state...");
      playerSkillTree.applySkillTreeState(loadedData.player.skillTree);
      // IMPORTANT: After applying skill state (which applies bonuses), THEN recalculate stats
      playerStats.recalculateCurrentStats();
      console.log(
        "[ApplySkills] Finished applying skill tree state and recalculated stats."
      );
      // Emit statsChanged event AFTER recalculation due to skill application
      eventBus.emit("statsChanged", { component: playerStats });
    } else {
      console.error(
        "[ApplySkills] Player SkillTreeComponent, applySkillTreeState method, or StatsComponent not found!"
      );
    }
  }

  applyPlayerEquipmentState(loadedData) {
    if (
      !loadedData?.player?.equipment ||
      !this.gameInstance?.playerController?.player
    ) {
      console.warn(
        "[ApplyEquip] Cannot apply equipment state: Missing loaded data or player object."
      );
      return;
    }
    const playerEquipment =
      this.gameInstance.playerController.player.userData?.equipment;
    const playerInventory =
      this.gameInstance.playerController.player.userData?.inventory; // Get inventory ref
    console.log(
      `[ApplyEquip] Inventory BEFORE equipping:`,
      playerInventory?.items?.length ?? "N/A",
      JSON.stringify(playerInventory?.items)
    ); // Log count & content before

    if (
      playerEquipment &&
      typeof playerEquipment.applyEquippedItemsState === "function"
    ) {
      console.log("[ApplyEquip] Applying loaded equipment state...");
      // This method internally finds items in the already-loaded inventory
      playerEquipment.applyEquippedItemsState(loadedData.player.equipment);
      console.log("[ApplyEquip] Finished applying equipment state.");
      // The applyEquippedItemsState method should emit 'equipmentChanged' itself
    } else {
      console.error(
        "[ApplyEquip] Player EquipmentComponent or applyEquippedItemsState method not found!"
      );
    }
    console.log(
      `[ApplyEquip] Inventory AFTER equipping:`,
      playerInventory?.items?.length ?? "N/A",
      JSON.stringify(playerInventory?.items)
    ); // Log count & content after
  }

  // Apply Final Player Health State >>>
  // applyFinalPlayerHealthState(loadedData) {
  //   if (!loadedData?.player || !this.gameInstance?.playerController?.player) {
  //     console.warn(
  //       "[ApplyHealthFinal] Cannot apply player health state: Missing loaded data or player object."
  //     );
  //     return;
  //   }
  //   const player = this.gameInstance.playerController.player;
  //   console.log("[ApplyHealthFinal] Applying final player health...");

  //   const playerStats = player.userData?.stats; // Get stats again for finalized maxHealth
  //   const playerHealth = player.userData?.health;

  //   if (playerHealth && playerStats) {
  //     // Max health should be correct now after stats + skills applied
  //     playerHealth.maxHealth = playerStats.currentMaxHealth;

  //     const savedHealth =
  //       loadedData.player.currentHealth ?? playerHealth.maxHealth;
  //     playerHealth.currentHealth = Math.max(
  //       0,
  //       Math.min(playerHealth.maxHealth, savedHealth)
  //     );
  //     console.log(
  //       `[ApplyHealthFinal] Applied Health: ${Math.floor(
  //         playerHealth.currentHealth
  //       )} / ${Math.floor(playerHealth.maxHealth)}`
  //     );

  //     // Final UI update for health bar
  //     eventBus.emit("playerHealthChanged", {
  //       target: player,
  //       healthComponent: playerHealth,
  //     });
  //   } else {
  //     console.warn(
  //       "[ApplyHealthFinal] Player HealthComponent or StatsComponent not found."
  //     );
  //   }
  // }
}

// src/ui/UIManager.js
import eventBus from "../core/EventBus.js";
import { getAbilityData } from "../config/AbilityConfig.js";
import { getRecipeData, CRAFTING_RECIPES } from "../config/CraftingConfig.js";
import {
  SKILL_TREE_CONFIG,
  getSkillNodeData,
} from "../config/SkillTreeConfig.js";
import { getItemData } from "../config/ItemConfig.js";
import { TooltipHelper } from "./TooltipHelper.js";
// Temp, for coordinates
import * as THREE from "three";

/**
 * Manages UI elements and interactions.
 * Updates UI based on game state or events.
 */
export class UIManager {
  /** @type {Game | null} Reference to the main Game instance */
  gameInstance = null; // reference to Game
  /** @type {PhysicsEngine | null} Reference to the physics engine */
  physicsEngineRef = null;
  /** @type {HTMLElement | null} The debug toggle button element */
  debugToggleButton = null;
  /** @type {HTMLElement | null} The unstuck button element */
  unstuckButton = null; // button reference
  /** @type {HTMLElement | null} The debug log area element */
  debugLogArea = null;

  /** @type {HTMLElement | null} The target health bar container */
  targetHealthBarContainer = null;
  /** @type {HTMLElement | null} The target health bar fill element */
  targetHealthBarFill = null;
  /** @type {HTMLElement | null} The target health bar label element */
  targetHealthBarLabel = null;

  /** @type {HealthComponent | null} Reference to the currently tracked health component */
  trackedHealthComponent = null;
  /** @type {number | null} Timeout ID for automatically hiding the health bar */
  hideHealthBarTimeout = null;
  /** @type {number} How long to show the health bar after the last hit (milliseconds) */
  healthBarVisibleDuration = 2000; // 3 seconds

  /** @type {HTMLElement | null} The inventory panel element */
  inventoryPanel = null;
  /** @type {NodeListOf<Element> | null} Collection of inventory slot elements */
  inventorySlots = null;
  /** @type {boolean} Is the inventory currently visible? */
  isInventoryVisible = false;
  /** @type {HTMLElement | null} The interaction prompt element */
  interactionPromptElement = null;

  /** @type {HTMLElement | null} The chat bubble element */
  chatBubbleElement = null;
  /** @type {number | null} The timeout ID for the chat bubble */
  chatBubbleTimeout = null;

  /** @type {HTMLElement | null} The action bar element */
  actionBarElement = null;
  /** @type {NodeListOf<Element> | null} Collection of action slot elements */
  actionSlots = null;

  /** @type {HTMLElement | null} The game clock display element */
  gameClockElement = null; //  property

  /** @type {HTMLElement | null} */
  newGameButton = null;
  /** @type {HTMLElement | null} */
  saveGameButton = null;
  /** @type {HTMLElement | null} */
  loadGameButton = null;

  // --- XP Bar Elements
  xpBarContainer = null;
  xpBarFill = null;
  xpBarLevelText = null;
  xpBarValueText = null;
  // --- END XP Bar Elements

  // --- Player Health Bar Elements
  playerHealthBarContainer = null;
  playerHealthBarFill = null;
  playerHealthBarText = null;
  // --- END Player Health Bar Elements

  timeForwardButton = null; //  property
  timeBackwardButton = null; //  property

  gameOverOverlay = null;
  gameOverNewGameButton = null;
  gameOverLoadGameButton = null;

  // craftingSystem = null;
  // consumableSystem = null;

  craftingMenuElement = null;
  craftingRecipesList = null;

  // --- Character Sheet Properties ---
  characterSheetElement = null;
  equipmentSlots = null; // NodeList of equip slots
  characterStatsDisplay = null; // Div to show stats
  isCharacterSheetVisible = false;
  characterToggleButton = null;
  // --- END Character Sheet Properties ---

  coordsDisplayElement = null; // Reference to the coordinate display element

  skillTreeContainerElement = null; // reference for skill tree container
  skillPointDisplayElement = null; // reference for skill point display

  tooltipHelper = null;

  creditsButton = null;
  creditsPanel = null;
  creditsCloseButton = null;

  /**
   * Initializes the UI Manager.
   * @param {Game} gameInstance - Reference to the main Game instance.
   * @param {PhysicsEngine} physicsEngine - Reference to the main PhysicsEngine instance.
   */
  constructor(gameInstance, physicsEngine) {
    // gameInstance parameter
    this.gameInstance = gameInstance;
    this.physicsEngineRef = physicsEngine;

    this.tooltipHelper = new TooltipHelper(); // <<< Instantiate tooltip helper

    // --- Get Game Over Elements ---
    this.gameOverOverlay = document.getElementById("game-over-overlay");
    this.gameOverNewGameButton = document.getElementById(
      "new-game-button-gameover"
    );
    this.gameOverLoadGameButton = document.getElementById(
      "load-game-button-gameover"
    );

    if (
      !this.gameOverOverlay ||
      !this.gameOverNewGameButton ||
      !this.gameOverLoadGameButton
    ) {
      console.warn("UIManager: One or more Game Over UI elements not found!");
    } else {
      // Link buttons to Game instance methods
      this.gameOverNewGameButton.addEventListener("click", () =>
        this.gameInstance?.triggerNewGame()
      );
      this.gameOverLoadGameButton.addEventListener("click", () =>
        this.gameInstance?.triggerLoadGame()
      );
      console.log("UIManager: Game Over buttons initialized.");
    }
    // --- End Get Game Over Elements ---

    // --- Get Credits Elements ---
    this.creditsButton = document.getElementById("credits-button");
    this.creditsPanel = document.getElementById("credits-panel");
    this.creditsCloseButton = document.getElementById("credits-close-button");

    if (this.creditsButton && this.creditsPanel && this.creditsCloseButton) {
      this.creditsButton.addEventListener(
        "click",
        this.toggleCreditsPanel.bind(this)
      );
      this.creditsCloseButton.addEventListener(
        "click",
        this.toggleCreditsPanel.bind(this)
      ); // Close button also toggles
      console.log("UIManager: Credits button and panel initialized.");
      // Ensure panel is hidden initially (CSS should handle this with .hidden class)
      this.creditsPanel.classList.add("hidden");
    } else {
      console.warn("UIManager: Credits button or panel elements not found!");
    }
    // --- End Credits Elements ---

    // --- Get XP Bar Elements
    this.xpBarContainer = document.getElementById("xp-bar-container");
    this.xpBarFill = document.getElementById("xp-bar-fill");
    this.xpBarLevelText = document.getElementById("xp-bar-level"); // Element for "Lvl X"
    this.xpBarValueText = document.getElementById("xp-bar-text"); // Element for "X / Y XP"
    if (
      !this.xpBarContainer ||
      !this.xpBarFill ||
      !this.xpBarLevelText ||
      !this.xpBarValueText
    ) {
      console.warn("UIManager: One or more XP bar elements not found!");
    }
    // --- Get Player Health Bar Elements
    this.playerHealthBarContainer = document.getElementById(
      "player-health-bar-container"
    );
    this.playerHealthBarFill = document.getElementById(
      "player-health-bar-fill"
    );
    this.playerHealthBarText = document.getElementById(
      "player-health-bar-text"
    );
    if (
      !this.playerHealthBarContainer ||
      !this.playerHealthBarFill ||
      !this.playerHealthBarText
    ) {
      console.warn(
        "UIManager: One or more Player health bar elements not found!"
      );
    }
    // --- END Get Player Health Bar Elements

    // Get Crafting Menu elements
    this.craftingMenuElement = document.getElementById("crafting-menu");
    this.craftingRecipesList = document.getElementById("crafting-recipes");
    if (!this.craftingMenuElement || !this.craftingRecipesList) {
      console.warn("UIManager: Crafting menu elements not found!");
    }

    // --- Event Listeners ---
    try {
      // Update crafting menu when inventory changes
      eventBus.on(
        "inventoryChanged",
        this.handleInventoryOrCraftingUpdate.bind(this)
      );
      // ... other listeners (buffExpired, xpGained, etc.) ...
    } catch (e) {
      // ... error handling ...
    }

    // --- Add Logs to check element retrieval
    console.log("[UIManager] Checking XP Bar Elements:");
    console.log("  Container:", this.xpBarContainer ? "FOUND" : "MISSING!");
    console.log("  Fill:", this.xpBarFill ? "FOUND" : "MISSING!");
    console.log("  Level Text:", this.xpBarLevelText ? "FOUND" : "MISSING!");
    console.log("  Value Text:", this.xpBarValueText ? "FOUND" : "MISSING!");

    // Get reference to menu options
    this.newGameButton = document.getElementById("new-game-button");
    this.saveGameButton = document.getElementById("save-game-button");
    this.loadGameButton = document.getElementById("load-game-button");

    // Get references to HealthBar UI elements
    this.debugToggleButton = document.getElementById("debug-toggle-button");
    this.unstuckButton = document.getElementById("unstuck-button"); // <<< Get unstuck button
    this.debugLogArea = document.getElementById("debug-log-area");

    this.hideChatButton = document.getElementById("hide-chat-button");
    this.chatElement = document.getElementById("debug-log-area");

    // Get Time Control Buttons
    this.timeBackwardButton = document.getElementById("time-backward-button");
    this.timeForwardButton = document.getElementById("time-forward-button");

    // Get Game Clock Element
    this.gameClockElement = document.getElementById("game-clock");
    if (!this.gameClockElement) {
      console.warn("UIManager: Game clock element ('game-clock') not found!");
    }

    this.inventoryToggleButton = document.getElementById(
      "inventory-toggle-button"
    );

    this.targetHealthBarContainer = document.getElementById(
      "target-health-bar-container"
    );
    this.targetHealthBarFill = document.getElementById(
      "target-health-bar-fill"
    );
    this.targetHealthBarLabel = document.getElementById(
      "target-health-bar-label"
    );

    if (
      !this.targetHealthBarContainer ||
      !this.targetHealthBarFill ||
      !this.targetHealthBarLabel
    ) {
      console.warn("UIManager: Target health bar elements not found!");
    }

    // Get action bar elements
    this.actionBarElement = document.getElementById("action-bar");
    if (this.actionBarElement) {
      this.actionSlots = this.actionBarElement.querySelectorAll(".action-slot");
    } else {
      console.warn("UIManager: Action bar element not found!");
    }

    this.coordsDisplayElement = this.createCoordsElement();

    // Get inventory elements
    this.inventoryPanel = document.getElementById("inventory-panel");
    if (this.inventoryPanel) {
      this.inventorySlots =
        this.inventoryPanel.querySelectorAll(".inventory-slot");
    } else {
      console.warn("UIManager: Inventory panel not found!");
    }

    // Get interaction prompt element
    this.interactionPromptElement =
      document.getElementById("interaction-prompt");
    if (!this.interactionPromptElement) {
      console.warn("UIManager: Interaction prompt element not found!");
    }

    // Get chat bubble element
    this.chatBubbleElement = document.getElementById("chat-bubble");
    if (!this.chatBubbleElement) {
      console.warn("UIManager: Chat bubble element not found!");
    }

    try {
      eventBus.on("inventoryChanged", this.handleInventoryChange.bind(this));
      eventBus.on("equipmentChanged", this.handleEquipmentChange.bind(this)); //  Listener
      eventBus.on("statsChanged", this.handleStatsChange.bind(this)); //  listener for general stats changes (like skill points)
      eventBus.on("skillTreeChanged", this.handleSkillTreeChange.bind(this)); //  listener for skill tree updates
      eventBus.on("buffExpired", this.handleBuffExpired.bind(this));
      // <<< Listen for XP/Level Events
      eventBus.on("xpGained", this.handleXpChange.bind(this)); // <<< Check this line
      eventBus.on("playerLeveledUp", this.handleLevelUp.bind(this));
      eventBus.on(
        "playerHealthChanged",
        this.handlePlayerHealthChange.bind(this)
      ); // <<< LISTEN for player health
      eventBus.on(
        "entityHealthChanged",
        this.handleEntityHealthChange.bind(this)
      ); // <<< Listen for special attacks, or any other damage.
      console.log(
        "[UIManager] Event listeners attached for ... entityHealthChanged."
      ); // Update log
      console.log(
        "[UIManager] Event listeners attached for xpGained/playerLeveledUp/inventoryChanged/buffExpired/playerHealthChanged."
      );
    } catch (e) {
      console.error("[UIManager] Error attaching event listeners:", e);
    }

    // --- Get Character Sheet & Skill Tree Elements ---
    this.characterSheetElement = document.getElementById("character-sheet");
    this.characterStatsDisplay = document.getElementById(
      "character-stats-display"
    );
    this.characterToggleButton = document.getElementById(
      "character-toggle-button"
    );
    this.skillTreeContainerElement = document.getElementById(
      "skill-tree-container"
    ); // <<< GET Skill Tree Container
    this.skillPointDisplayElement = document.getElementById(
      "skill-points-display"
    ); // <<< GET Skill Points Display

    if (this.characterSheetElement) {
      this.equipmentSlots =
        this.characterSheetElement.querySelectorAll(".equip-slot");
    } else {
      console.warn("UIManager: Character sheet element not found!");
    }
    if (!this.characterStatsDisplay) {
      console.warn("UIManager: Character stats display element not found!");
    }
    if (!this.skillTreeContainerElement) {
      console.warn(
        "UIManager: Skill tree container element (#skill-tree-container) not found!"
      );
    }
    if (!this.skillPointDisplayElement) {
      console.warn(
        "UIManager: Skill points display element (#skill-points-display) not found!"
      );
    }
    if (!this.characterToggleButton) {
      console.warn("UIManager: Character toggle button not found!");
    } else {
      this.characterToggleButton.addEventListener(
        "click",
        this.toggleCharacterSheet.bind(this)
      );
    }
    // --- End Get Elements ---

    // --- Setup Time Control Button Listeners
    if (this.timeBackwardButton) {
      this.timeBackwardButton.addEventListener("click", () => {
        // Adjust time BACKWARDS by 1 hour
        this.gameInstance?.adjustGameTime(-1);
      });
      console.log("[UIManager] Time Backward button initialized.");
    } else {
      console.error("[UIManager] Time Backward button not found!");
    }

    if (this.timeForwardButton) {
      this.timeForwardButton.addEventListener("click", () => {
        // Adjust time FORWARDS by 1 hour
        this.gameInstance?.adjustGameTime(1);
      });
      console.log("[UIManager] Time Forward button initialized.");
    } else {
      console.error("[UIManager] Time Forward button not found!");
    }
    // --- END Setup Time Control Listeners

    // --- Setup Event Listeners for Menu options ---
    if (this.newGameButton) {
      this.newGameButton.addEventListener("click", () =>
        this.gameInstance?.triggerNewGame()
      );
      console.log("UIManager: New Game button initialized.");
    } else console.error("UIManager: New Game button not found!");

    if (this.saveGameButton) {
      this.saveGameButton.addEventListener("click", () =>
        this.gameInstance?.triggerSaveGame()
      );
      console.log("UIManager: Save Game button initialized.");
    } else console.error("UIManager: Save Game button not found!");

    if (this.loadGameButton) {
      this.loadGameButton.addEventListener("click", () =>
        this.gameInstance?.triggerLoadGame()
      );
      console.log("UIManager: Load Game button initialized.");
    } else console.error("UIManager: Load Game button not found!");

    // Setup Debug Toggle Button
    if (!this.debugToggleButton) {
      console.log("UIManager: Debug toggle button not found!");
    } else {
      this.debugToggleButton.addEventListener(
        "click",
        this.toggleDebugView.bind(this)
      );
      this.updateDebugButtonText();
      console.log("UIManager: Debug toggle button initialized.");
    }

    // Setup Unstuck Button
    if (!this.unstuckButton) {
      console.error("UIManager: Unstuck button not found!");
    } else {
      this.unstuckButton.addEventListener(
        "click",
        this.onUnstuckClick.bind(this)
      );
      console.log("UIManager: Unstuck button initialized.");
    }

    // Setup Inventory Toggle Button
    if (!this.inventoryToggleButton) {
      console.error("UIManager: Inventory toggle button not found!");
    } else {
      this.inventoryToggleButton.addEventListener(
        "click",
        this.toggleInventoryDisplay.bind(this)
      );
      console.log("UIManager: Inventory toggle button initialized.");
    }

    // Setup Hide Chat Button
    if (!this.hideChatButton) {
      console.error("UIManager: Hide chat button not found!");
    } else {
      this.hideChatButton.addEventListener(
        "click",
        this.toggleChatDisplay.bind(this)
      );
      console.log("UIManager: Hide chat button initialized.");
    }

    if (!this.debugLogArea) {
      /* ... log area setup ... */
    }

    // --- Hide health bars initially ---
    if (this.targetHealthBarContainer)
      this.targetHealthBarContainer.style.display = "none";
    if (this.playerHealthBarContainer)
      // this.playerHealthBarContainer.style.display = "none";

      console.log("UIManager initialized.");
    this.log("UI Manager Ready."); // Initial log message
  }

  // --- Toggle Function ---
  toggleCreditsPanel() {
    if (!this.creditsPanel) return;

    const isVisible = !this.creditsPanel.classList.contains("hidden");

    if (isVisible) {
      // Hide it
      this.creditsPanel.classList.add("hidden");
      this.log("Credits Closed.");
    } else {
      // Show it
      this.creditsPanel.classList.remove("hidden");
      this.log("Credits Opened.");
      // Optional: Bring to front if other panels might overlap
      // this.creditsPanel.style.zIndex = '151';
    }
  }

  //  Method to create/get coordinate element
  createCoordsElement() {
    let element = document.getElementById("player-coordinates");
    if (!element) {
      element = document.createElement("div");
      element.id = "player-coordinates";
      element.textContent = "Coords: X:-- Y:-- Z:--";
      // Append it somewhere sensible, e.g., top-left or near debug controls
      // Option 1: Append to body (simplest)
      document.body.appendChild(element);
      // Option 2: Append to a specific UI container if you have one
      // const uiContainer = document.getElementById('ui-container');
      // uiContainer?.appendChild(element);
      console.log("UIManager: Player Coordinates element created.");
    }
    return element;
  }

  //  Method to update coordinate display text
  /**
   * Updates the coordinate display element.
   * @param {HTMLElement} element - The coordinate display DOM element.
   * @param {THREE.Vector3} position - The player's current world position.
   */
  updateCoordsDisplay(element, position) {
    if (element && position) {
      const x = position.x.toFixed(1);
      const y = position.y.toFixed(1);
      const z = position.z.toFixed(1);
      element.textContent = `Coords: X:${x} Y:${y} Z:${z}`;
    } else if (element) {
      element.textContent = "Coords: X:-- Y:-- Z:--"; // Show default if position is invalid
    }
  }

  /** Handles stats changes, specifically updating skill points and skill tree availability */
  handleStatsChange(eventData) {
    // Check if the event relates to the player's stats component
    if (
      eventData?.component ===
      this.gameInstance?.playerController?.player?.userData?.stats
    ) {
      console.log(
        "Stats changed, updating skill point display and skill tree UI..."
      );
      this.updateSkillPointDisplay(); // Update the points counter
      // Refresh the skill tree display as availability might have changed
      if (this.isCharacterSheetVisible) {
        this.updateSkillTreeDisplay();
      }
    }
  }

  /** Handles skill tree changes (e.g., skill unlocked/upgraded) */
  handleSkillTreeChange(eventData) {
    // Check if the event relates to the player's skill tree component
    if (
      eventData?.component ===
      this.gameInstance?.playerController?.player?.userData?.skillTree
    ) {
      console.log(
        `Skill tree changed (Skill: ${eventData?.skillId}, NewRank: ${eventData?.newRank}), updating UI...`
      );
      // Refresh the skill tree display
      if (this.isCharacterSheetVisible) {
        this.updateSkillTreeDisplay();
      }
      // Also update stats display as bonuses might have changed
      this.updateCharacterStatsDisplay();
    }
  }

  // --- Handler for Equipment Change ---
  handleEquipmentChange(eventData) {
    console.log("Equipment changed, updating UI...");
    if (this.isCharacterSheetVisible && eventData?.component) {
      this.updateCharacterSheet(eventData.component);
    }
    // Also update inventory/crafting because unequipping adds items back
    this.handleInventoryOrCraftingUpdate();

    // Update stats display as equipment affects them
    if (this.isCharacterSheetVisible) {
      this.updateCharacterStatsDisplay();
    }
  }

  // --- Toggle Method ---
  toggleCharacterSheet() {
    if (!this.characterSheetElement) return;
    this.isCharacterSheetVisible = !this.isCharacterSheetVisible;

    if (this.isCharacterSheetVisible) {
      this.characterSheetElement.classList.remove("hidden");
      // Update ALL relevant sections when opening
      const player = this.gameInstance?.playerController?.player;
      if (player) {
        this.updateCharacterSheet(player.userData?.equipment);
        this.updateCharacterStatsDisplay();
        this.updateSkillPointDisplay(); // <<< Make sure points are up-to-date
        this.updateSkillTreeDisplay(); // <<< Update skill tree view
      }
    } else {
      this.characterSheetElement.classList.add("hidden");
    }
    this.log(
      `Character Sheet ${this.isCharacterSheetVisible ? "Opened" : "Closed"}`
    );
  }

  /** Updates the display of available skill points */
  updateSkillPointDisplay() {
    if (!this.skillPointDisplayElement) return;
    const points =
      this.gameInstance?.playerController?.player?.userData?.stats
        ?.availableSkillPoints ?? 0;
    this.skillPointDisplayElement.textContent = `Skill Points: ${points}`;
  }

  /** Renders the skill tree nodes in the UI */
  updateSkillTreeDisplay() {
    if (!this.skillTreeContainerElement) return;

    const skillTreeComp =
      this.gameInstance?.playerController?.player?.userData?.skillTree;
    const statsComp =
      this.gameInstance?.playerController?.player?.userData?.stats;

    if (!skillTreeComp || !statsComp) {
      this.skillTreeContainerElement.innerHTML =
        "<p>Skill Tree unavailable.</p>";
      console.warn(
        "Cannot update skill tree display: Missing SkillTreeComponent or StatsComponent."
      );
      return;
    }

    this.skillTreeContainerElement.innerHTML = ""; // Clear previous nodes

    // Iterate through the configuration to create nodes
    for (const skillId in SKILL_TREE_CONFIG) {
      const nodeData = SKILL_TREE_CONFIG[skillId];
      if (!nodeData) continue;

      const nodeElement = document.createElement("div");
      nodeElement.classList.add("skill-node");
      nodeElement.dataset.skillId = skillId; // Store ID for click handler

      // --- Positioning ---
      // Adjust based on container size and desired layout density
      const scaleX = this.skillTreeContainerElement.offsetWidth / 300; // Scaling based on config range
      const scaleY = this.skillTreeContainerElement.offsetHeight / 400;
      const posX = (nodeData.uiPosition?.x ?? 0) + 150; // Center horizontally roughly
      const posY = nodeData.uiPosition?.y ?? 0;
      nodeElement.style.left = `calc(${posX * scaleX}px - 37.5px)`; // Center node (half width)
      nodeElement.style.top = `${posY * scaleY}px`;

      // --- Determine State & Apply Classes ---
      const currentRank = skillTreeComp.getSkillRank(skillId);
      const maxRank = nodeData.maxRank || 1;
      const canUpgrade = skillTreeComp.canUnlockOrUpgrade(skillId);

      nodeElement.classList.toggle("learned", currentRank > 0);
      nodeElement.classList.toggle("available", canUpgrade);
      nodeElement.classList.toggle("maxed", currentRank >= maxRank);
      nodeElement.classList.toggle("locked", !canUpgrade && currentRank === 0);

      // --- Icon ---
      const iconImg = document.createElement("img");
      iconImg.src = nodeData.iconSvgPath || "/icons/uncertainty.svg"; // Default icon
      iconImg.alt = nodeData.name;
      nodeElement.appendChild(iconImg);

      // --- Name ---
      const nameSpan = document.createElement("span");
      nameSpan.classList.add("skill-name");
      nameSpan.textContent = nodeData.name;
      nodeElement.appendChild(nameSpan);

      // --- Rank ---
      const rankSpan = document.createElement("span");
      rankSpan.classList.add("skill-rank");
      rankSpan.textContent = `${currentRank}/${maxRank}`;
      nodeElement.appendChild(rankSpan);

      // --- Tooltip ---
      // let tooltip = `${nodeData.name} (Rank ${currentRank}/${maxRank})\n`;
      // tooltip += `Req. Level: ${nodeData.requiredLevel || 1}\n`;
      // const costArray = Array.isArray(nodeData.costPerRank)
      //   ? nodeData.costPerRank
      //   : [nodeData.costPerRank || 1];
      // const nextCost =
      //   currentRank < maxRank
      //     ? costArray[currentRank] ?? costArray[costArray.length - 1] ?? "?"
      //     : "-";
      // tooltip += `Cost: ${nextCost} SP\n`;
      // if (nodeData.prerequisites && nodeData.prerequisites.length > 0) {
      //   tooltip += `Requires: ${nodeData.prerequisites
      //     .map((id) => SKILL_TREE_CONFIG[id]?.name || id)
      //     .join(", ")}\n`;
      // }
      // tooltip += `\n${nodeData.description || ""}`;
      // // Show effects for the *next* rank if applicable
      // if (currentRank < maxRank && nodeData.effectsPerRank) {
      //   const nextRankEffects = nodeData.effectsPerRank[currentRank]; // Effects for the rank they would GET
      //   if (nextRankEffects) {
      //     tooltip += `\nNext Rank:`;
      //     const effectsArray = Array.isArray(nextRankEffects)
      //       ? nextRankEffects
      //       : [nextRankEffects];
      //     effectsArray.forEach((effect) => {
      //       if (effect.stat) {
      //         tooltip += ` +${effect.value} ${effect.stat}`;
      //       }
      //       if (effect.unlockAbility) {
      //         tooltip += ` Unlocks ${effect.unlockAbility}`;
      //       }
      //     });
      //   }
      // }
      // nodeElement.title = tooltip.trim();

      // Old tooltip code
      // // --- Tooltip Content Generation Function --- <<< NEW
      // const getTooltipContent = () => {
      //   // Recalculate needed info inside the function to ensure freshness
      //   const currentRankFunc = skillTreeComp.getSkillRank(skillId); // Get current rank again
      //   let tooltip = `${nodeData.name} (Rank ${currentRankFunc}/${maxRank})\n`;
      //   tooltip += `Req. Level: ${nodeData.requiredLevel || 1}\n`;
      //   const costArrayFunc = Array.isArray(nodeData.costPerRank)
      //     ? nodeData.costPerRank
      //     : [nodeData.costPerRank || 1];
      //   const nextCostFunc =
      //     currentRankFunc < maxRank
      //       ? costArrayFunc[currentRankFunc] ??
      //         costArrayFunc[costArrayFunc.length - 1] ??
      //         "?"
      //       : "-";
      //   tooltip += `Cost: ${nextCostFunc} SP\n`;
      //   if (nodeData.prerequisites && nodeData.prerequisites.length > 0) {
      //     tooltip += `Requires: ${nodeData.prerequisites
      //       .map((id) => SKILL_TREE_CONFIG[id]?.name || id)
      //       .join(", ")}\n`;
      //   }
      //   tooltip += `\n${nodeData.description || ""}`;
      //   if (currentRankFunc < maxRank && nodeData.effectsPerRank) {
      //     const nextRankEffectsFunc = nodeData.effectsPerRank[currentRankFunc];
      //     if (nextRankEffectsFunc) {
      //       tooltip += `\nNext Rank:`;
      //       const effectsArrayFunc = Array.isArray(nextRankEffectsFunc)
      //         ? nextRankEffectsFunc
      //         : [nextRankEffectsFunc];
      //       effectsArrayFunc.forEach((effect) => {
      //         if (effect.stat) {
      //           tooltip += ` +${effect.value} ${effect.stat}`;
      //         }
      //         if (effect.unlockAbility) {
      //           tooltip += ` Unlocks ${effect.unlockAbility}`;
      //         }
      //       });
      //     }
      //   }
      //   return tooltip.trim();
      // };
      // // --- Attach Tooltip --- <<< NEW
      // this.tooltipHelper.attach(nodeElement, getTooltipContent);

      // --- Tooltip Content Generation Function ---
      const getTooltipContent = () => {
        // Recalculate needed info inside the function to ensure freshness
        const currentRankFunc = skillTreeComp.getSkillRank(skillId); // Get current rank again
        const nodeData = SKILL_TREE_CONFIG[skillId]; // Get nodeData inside function scope
        const maxRank = nodeData.maxRank || 1; // Get maxRank inside function scope

        let tooltip = `${nodeData.name} (Rank ${currentRankFunc}/${maxRank})\n`;
        tooltip += `Req. Level: ${nodeData.requiredLevel || 1}\n`;
        const costArrayFunc = Array.isArray(nodeData.costPerRank)
          ? nodeData.costPerRank
          : [nodeData.costPerRank || 1];
        const nextCostFunc =
          currentRankFunc < maxRank
            ? costArrayFunc[currentRankFunc] ??
              costArrayFunc[costArrayFunc.length - 1] ??
              "?"
            : "-";
        tooltip += `Cost: ${nextCostFunc} SP\n`;
        if (nodeData.prerequisites && nodeData.prerequisites.length > 0) {
          tooltip += `Requires: ${nodeData.prerequisites
            .map((id) => SKILL_TREE_CONFIG[id]?.name || id)
            .join(", ")}\n`;
        }
        tooltip += `\n${nodeData.description || ""}`;

        // --- "Next Rank" Logic ---
        if (currentRankFunc < maxRank && nodeData.effectsPerRank) {
          const nextRankIndex = currentRankFunc; // Index for the rank they WILL achieve
          const currentRankIndex = currentRankFunc - 1; // Index for the rank they CURRENTLY have (-1 if rank 0)

          const nextRankEffects = nodeData.effectsPerRank[nextRankIndex];

          if (nextRankEffects) {
            tooltip += `\nNext Rank:`;
            const effectsArrayNext = Array.isArray(nextRankEffects)
              ? nextRankEffects
              : [nextRankEffects];

            effectsArrayNext.forEach((nextEffect) => {
              if (nextEffect.stat) {
                let currentEffectValue = 0;
                // Find the value of the stat at the CURRENT rank
                if (currentRankIndex >= 0) {
                  // Only if current rank > 0
                  const currentRankEffects =
                    nodeData.effectsPerRank[currentRankIndex];
                  if (currentRankEffects) {
                    const effectsArrayCurrent = Array.isArray(
                      currentRankEffects
                    )
                      ? currentRankEffects
                      : [currentRankEffects];
                    const currentStatEffect = effectsArrayCurrent.find(
                      (e) =>
                        e.stat === nextEffect.stat && e.type === nextEffect.type
                    );
                    if (currentStatEffect) {
                      currentEffectValue = currentStatEffect.value;
                    }
                  }
                }

                // Calculate the difference (delta)
                const valueDelta = nextEffect.value - currentEffectValue;

                // Format the delta for display (handle potential floating point inaccuracies)
                const formattedDelta = Number(valueDelta.toFixed(3)); // Use toFixed and convert back to number to remove trailing zeros

                // Display the delta
                tooltip += ` +${formattedDelta} ${nextEffect.stat}`;
              } else if (nextEffect.unlockAbility) {
                // Unlock effect (no delta calculation needed)
                tooltip += ` Unlocks ${nextEffect.unlockAbility}`;
              }
            });
          }
        }

        return tooltip.trim();
      };
      // --- Attach Tooltip ---
      this.tooltipHelper.attach(nodeElement, getTooltipContent); //

      // --- Click Listener ---
      if (canUpgrade) {
        nodeElement.onclick = (event) => {
          event.stopPropagation(); // Prevent character sheet closing maybe
          skillTreeComp.unlockOrUpgradeSkill(skillId);
          // UI update will be triggered by the 'skillTreeChanged' event
        };
      } else {
        nodeElement.onclick = null; // Remove listener if not upgradeable
      }

      this.skillTreeContainerElement.appendChild(nodeElement);
    }
    // TODO: Draw connection lines (more complex, maybe later)
  }

  // --- Update Character Sheet Method ---
  updateCharacterSheet(equipmentComponent) {
    if (!this.equipmentSlots || !equipmentComponent) {
      console.warn(
        "Cannot update character sheet: Slots or equipment component missing."
      );
      this.equipmentSlots?.forEach((slot) => {
        // Clear slots if component missing
        this.tooltipHelper.detach(slot); // <<< Detach tooltip
        slot.innerHTML = slot.dataset.slot || "Error"; // Show slot name or error
        slot.classList.add("empty");
      });
      return;
    }

    this.equipmentSlots.forEach((slotElement) => {
      const slotName = slotElement.dataset.slot; // Get slot type from data attribute
      if (!slotName) return;

      // Detach any previous tooltip before updating content
      this.tooltipHelper.detach(slotElement); // <<< Detach tooltip

      const equippedItem = equipmentComponent.getEquippedItem(slotName); // Get item from component

      slotElement.innerHTML = ""; // Clear previous content
      slotElement.classList.toggle("empty", !equippedItem); // Add/remove empty class

      if (equippedItem) {
        // Item is equipped - display it
        const itemData = getItemData(equippedItem.itemId); // Get full data for display info

        // --- Tooltip Content ---
        const getTooltipContent = () => {
          let tooltipText = "";
          if (itemData) {
            tooltipText += itemData.name || equippedItem.itemId;
            if (itemData.description) {
              tooltipText += `\n${itemData.description}`;
            }
            if (typeof itemData.weight === "number") {
              tooltipText += `\nWeight: ${itemData.weight.toFixed(1)}`;
            }
            // Add Equipment Bonuses to tooltip
            if (itemData.statsBonus) {
              tooltipText += `\nBonuses:`;
              for (const statKey in itemData.statsBonus) {
                /* ... format bonuses ... */ const bonusValue =
                  itemData.statsBonus[statKey];
                let formattedStat = statKey.replace(/([A-Z])/g, " $1");
                formattedStat =
                  formattedStat.charAt(0).toUpperCase() +
                  formattedStat.slice(1);
                if (statKey.toLowerCase().includes("resistance")) {
                  tooltipText += `\n  +${Math.round(
                    bonusValue * 100
                  )}% ${formattedStat}`;
                } else if (statKey.toLowerCase() === "damage") {
                  tooltipText += `\n  +${bonusValue} Damage`;
                } else if (statKey.toLowerCase() === "maxhealth") {
                  tooltipText += `\n  +${bonusValue} Max Health`;
                } else {
                  tooltipText += `\n  +${bonusValue} ${formattedStat}`;
                }
              }
            }
          } else {
            tooltipText = equippedItem.itemId;
          }
          return tooltipText.trim();
        };
        this.tooltipHelper.attach(slotElement, getTooltipContent); // <<< Attach tooltip
        // --- End Tooltip Content ---

        // // --- Icon ---
        // const iconElement = document.createElement("div");
        // iconElement.classList.add("item-icon");
        // // Add specific class for potential styling
        // if (itemData?.equipSlot) iconElement.classList.add(itemData.equipSlot);
        // iconElement.textContent = equippedItem.itemId
        //   .substring(0, 2)
        //   .toUpperCase();
        // slotElement.title = itemData?.name || equippedItem.itemId; // Tooltip
        // slotElement.appendChild(iconElement);

        // --- Icon ---
        const iconElement = document.createElement("div"); // Container still useful
        iconElement.classList.add("item-icon");
        // Add specific class based on slot name if needed for styling
        if (slotName) iconElement.classList.add(slotName);

        if (itemData?.iconImagePath) {
          // Create an image element if path exists
          const img = document.createElement("img");
          img.src = itemData.iconImagePath;
          img.alt = itemData.name || equippedItem.itemId;
          // img.classList.add('item-icon'); // Apply class directly to img
          iconElement.appendChild(img); // Append img to the icon container div
        } else {
          // Fallback to placeholder text if no icon path
          iconElement.textContent = equippedItem.itemId
            .substring(0, 2)
            .toUpperCase();
          console.warn(
            `Missing iconImagePath for equipped item: ${equippedItem.itemId}`
          );
        }
        slotElement.appendChild(iconElement);
        // --- End Icon Modification ---

        // --- Name (Optional) ---
        // const nameElement = document.createElement("div");
        // nameElement.textContent = itemData?.name || equippedItem.itemId;
        // nameElement.style.fontSize = '9px';
        // slotElement.appendChild(nameElement);

        // --- Unequip Button ---
        const unequipButton = document.createElement("button");
        unequipButton.textContent = "Unequip";
        unequipButton.classList.add("item-button"); // Use common style
        unequipButton.onclick = (event) => {
          event.stopPropagation();
          equipmentComponent.unequipItem(slotName);
          // UI update is handled by the equipmentChanged event
        };
        slotElement.appendChild(unequipButton);
      } else {
        // Slot is empty - display placeholder text (slot name)
        slotElement.textContent =
          slotName.charAt(0).toUpperCase() + slotName.slice(1); // Capitalize
      }
    });
  }

  // Update Character Stats Display ---
  updateCharacterStatsDisplay() {
    if (!this.characterStatsDisplay) return;

    const statsComp =
      this.gameInstance?.playerController?.player?.userData?.stats;
    if (!statsComp) {
      this.characterStatsDisplay.innerHTML = "<p>Stats unavailable.</p>";
      return;
    }

    // Optional: Recalculate just before display? Might be redundant.
    // statsComp.recalculateCurrentStats();

    const healthComp =
      this.gameInstance?.playerController?.player?.userData?.health;

    // Get precise values first
    const preciseCurrentHealth = healthComp?.currentHealth ?? 0;
    const preciseMaxHealth = statsComp.currentMaxHealth; // Already calculated

    const coldResPercent = Math.round(
      (statsComp.currentColdResistance || 0) * 100
    );
    const dmgRedPercent = Math.round(
      (statsComp.currentDamageReduction || 0) * 100
    );

    // Use Math.floor() for displaying health values
    let statsHTML = `
        <p>❤️ HP: ${Math.floor(preciseCurrentHealth)} / ${Math.floor(
      preciseMaxHealth
    )}</p>
        <p>⚔️ Damage: ${statsComp.currentDamage.toFixed(1)}</p>
        <p>🛡️ Dmg. Reduction: ${dmgRedPercent}%</p>
        <p>❄️ Cold Resist: ${coldResPercent}%</p>
        <p>🥾 Speed: ${statsComp.currentSpeed.toFixed(1)}</p>
        <p>🥾 Run Speed: ${statsComp.currentRunSpeed.toFixed(1)}</p>
        `;
    this.characterStatsDisplay.innerHTML = statsHTML;
  }

  // --- Method to Show Game Over Screen ---
  showGameOverScreen() {
    if (!this.gameOverOverlay) return;

    // Optional: Hide other non-essential UI elements first
    this.hideChatBubble();
    this.setInteractionPrompt("");
    // Add other UI elements to hide if desired (e.g., action bar, health bars)
    if (this.actionBarElement) this.actionBarElement.style.display = "none";
    if (this.xpBarContainer) this.xpBarContainer.style.display = "none";
    if (this.playerHealthBarContainer)
      this.playerHealthBarContainer.style.display = "none";
    if (this.targetHealthBarContainer)
      this.targetHealthBarContainer.style.display = "none";
    if (this.inventoryPanel) this.inventoryPanel.style.display = "none"; // Hide inventory if open

    // Make overlay visible using CSS class for transition
    this.gameOverOverlay.style.display = "flex"; // Set display before adding class
    // Use setTimeout to allow the display change to apply before starting transition
    setTimeout(() => {
      this.gameOverOverlay.classList.add("visible");
    }, 10); // Small delay
  }

  /**
   * Updates the player's XP bar display.
   * @param {number} level - Current player level.
   * @param {number} currentXP - Current XP points.
   * @param {number} xpToNextLevel - XP needed for the next level (can be Infinity).
   */
  updateXpBar(level, currentXP, xpToNextLevel) {
    if (
      !this.xpBarContainer ||
      !this.xpBarFill ||
      !this.xpBarLevelText ||
      !this.xpBarValueText
    ) {
      // Don't try to update if elements aren't found
      return;
    }

    // Ensure container is visible (it might be hidden initially)
    this.xpBarContainer.style.display = "flex";

    // Update Level Text
    this.xpBarLevelText.textContent = `Lvl ${level}`;

    // Update XP Text and Bar Fill
    let xpPercent = 0;
    if (xpToNextLevel > 0 && xpToNextLevel !== Infinity) {
      // Calculate percentage for the bar fill
      xpPercent = Math.max(0, Math.min(100, (currentXP / xpToNextLevel) * 100));
      this.xpBarValueText.textContent = `${Math.floor(
        currentXP
      )} / ${xpToNextLevel} XP`;
    } else {
      // Handle level cap or invalid data
      xpPercent = 100; // Fill bar at max level
      this.xpBarValueText.textContent = `MAX LEVEL`;
    }

    this.xpBarFill.style.width = `${xpPercent}%`;
  }

  /**
   * Updates the player's health bar display.
   * @param {number} currentHealth - Current health points.
   * @param {number} maxHealth - Maximum health points.
   */
  updatePlayerHealthBar(currentHealth, maxHealth) {
    if (
      !this.playerHealthBarContainer ||
      !this.playerHealthBarFill ||
      !this.playerHealthBarText
    ) {
      return; // Don't update if elements missing
    }
    this.playerHealthBarContainer.style.display = "block";

    // Keep percentage calculation precise
    const healthPercent =
      maxHealth > 0 ? (Math.max(0, currentHealth) / maxHealth) * 100 : 0;

    this.playerHealthBarFill.style.width = `${healthPercent}%`;

    // --- Use Math.floor() for Text Display
    this.playerHealthBarText.textContent = `${Math.floor(
      Math.max(0, currentHealth) // Floor current health for display
    )} / ${Math.floor(maxHealth)}`; // Floor max health for display
  }

  /** Handles player health change events */ // <<< NEW Handler
  handlePlayerHealthChange(eventData) {
    if (eventData?.target?.userData?.isPlayer) {
      this.updatePlayerHealthBar(
        eventData.healthComponent.currentHealth,
        eventData.healthComponent.maxHealth
      );
      // Also update stats display in character sheet if open
      if (this.isCharacterSheetVisible) {
        this.updateCharacterStatsDisplay();
      }
    }
  }

  /** Handles XP gain events */
  handleXpChange(eventData) {
    // Directly call updateXpBar with data from the event
    // --- Log event reception ---
    console.log("[UIManager] handleXpChange RECEIVED event:", eventData);
    if (eventData) {
      this.updateXpBar(
        eventData.level,
        eventData.currentXP,
        eventData.xpToNextLevel
      );
    } else {
      console.warn("[UIManager] handleXpChange received invalid event data.");
    }
  }

  /** Handles level up events */
  handleLevelUp(eventData) {
    // Update the XP bar with the new level and thresholds
    this.updateXpBar(eventData.newLevel, 0, eventData.xpToNextLevel);
    this.showChatBubble(
      `Level Up! Reached Level ${eventData.newLevel}! Got some Skill Points!`,
      4000
    );
    if (eventData.bonuses) {
      /* ... log bonuses ... */
      let bonusText = Object.values(eventData.bonuses).join(", ");
      this.log(`Level Up Bonuses: ${bonusText}`);
    }
    // Update skill point display and potentially tree availability
    this.updateSkillPointDisplay();
    if (this.isCharacterSheetVisible) {
      this.updateSkillTreeDisplay();
    }
  }

  /**
   * Updates the in-game clock display.
   * @param {number} currentGameTime - The total elapsed game time in seconds (starts at 0).
   * @param {number} durationOfDay - The total duration of a full day/night cycle in seconds.
   * @param {number} dayCount - The current day number (starting from 1).
   */
  updateGameClock(currentGameTime, durationOfDay, dayCount) {
    if (!this.gameClockElement || durationOfDay <= 0) return;

    // Calculate the base progress based on the underlying gameTime (0.0 to 1.0)
    const baseCycleProgress = (currentGameTime % durationOfDay) / durationOfDay;

    // --- Apply Display Offset ---
    const startHourOffset = 5.5; // Start display at 5:30 AM
    const offsetFraction = startHourOffset / 24; // Offset as fraction of a day
    // Add offset and wrap around using modulo 1.0
    const displayCycleProgress = (baseCycleProgress + offsetFraction) % 1.0;
    // --- End Apply Display Offset ---

    // Calculate display hour (0-23) based on the offset progress
    const totalHours = displayCycleProgress * 24;
    const displayHour = Math.floor(totalHours) % 24;

    // Calculate display minute (0-59)
    const fractionalHour = totalHours - Math.floor(totalHours);
    const displayMinute = Math.floor(fractionalHour * 60);

    // Format time string (HH:MM with leading zeros)
    const formattedHour = String(displayHour).padStart(2, "0");
    const formattedMinute = String(displayMinute).padStart(2, "0");
    const timeString =
      `${formattedHour}:${formattedMinute}` + `  Day: ${dayCount}`;

    // Update the UI element's text
    this.gameClockElement.textContent = timeString;
  }

  /**
   * Displays a message in the chat bubble for a limited duration.
   * @param {string} message - The text message to display.
   * @param {number} [durationMs=3000] - How long to show the message in milliseconds.
   */
  showChatBubble(message, durationMs = 3000) {
    if (!this.chatBubbleElement || !message) return;

    // Clear any existing timeout to prevent premature hiding
    if (this.chatBubbleTimeout) {
      clearTimeout(this.chatBubbleTimeout);
    }

    // Set the message and make visible
    this.chatBubbleElement.textContent = message;
    this.chatBubbleElement.style.display = "block"; // Ensure it's block before removing hidden
    this.chatBubbleElement.classList.remove("hidden");

    // Set a timer to hide the bubble
    this.chatBubbleTimeout = setTimeout(() => {
      this.hideChatBubble();
    }, durationMs);
  }

  /** Hides the chat bubble */
  hideChatBubble() {
    if (!this.chatBubbleElement) return;

    this.chatBubbleElement.classList.add("hidden");
    // Optional: Set display none after transition, but often opacity is enough
    // if (this.chatBubbleTimeout) { // Check if triggered by timeout
    //     setTimeout(() => {
    //         if (this.chatBubbleElement.classList.contains('hidden')) {
    //             this.chatBubbleElement.style.display = 'none';
    //         }
    //     }, 300); // Match CSS transition duration
    // } else {
    //      this.chatBubbleElement.style.display = 'none'; // Hide immediately if not via timeout
    // }

    this.chatBubbleTimeout = null; // Clear timeout ID
  }

  // Handler for buff expiration event >>>
  handleBuffExpired(eventData) {
    // Make the log message user-friendly
    const statName =
      eventData.stat.charAt(0).toUpperCase() + eventData.stat.slice(1); // Capitalize
    const message = `${statName} buff has expired.`;
    this.log(message); // Log to the UI chat/log
    this.showChatBubble(message, 2000); // Also show in bubble (optional)
  }

  // updateActionBar(abilityComponent) {
  //   if (!this.actionSlots || !abilityComponent) return;

  //   const knownAbilities = abilityComponent.getKnownAbilitiesArray();

  //   this.actionSlots.forEach((slot, index) => {
  //     const abilityId = knownAbilities[index];
  //     const currentAbilityIdInSlot = slot.dataset.abilityId; // Store current ID

  //     // --- Detach previous tooltip listener before potential changes ---
  //     // this.tooltipHelper.detach(slot); // This is important if the ability in the slot changes.

  //     // Only redraw icon if the ability ID is different or the slot was empty
  //     let needsIconUpdate = !slot.querySelector(".ability-icon"); // Check if icon div exists

  //     if (abilityId && currentAbilityIdInSlot !== abilityId) {
  //       needsIconUpdate = true; // Ability changed, need to update icon
  //     } else if (!abilityId && currentAbilityIdInSlot) {
  //       needsIconUpdate = true; // Ability removed, need to clear icon
  //       // slot.removeAttribute("title");
  //     }

  //     // Get ability data only
  //     const abilityData = abilityId ? getAbilityData(abilityId) : null;

  //     // --- Update Icon ---
  //     if (needsIconUpdate) {
  //       slot.innerHTML = ""; // Clear previous content (icon, hotkey, overlay)
  //       slot.dataset.abilityId = abilityId || ""; // Update stored ID

  //       if (abilityData) {
  //         // Set tooltip on the slot element when the icon is first drawn
  //         // slot.title = `${abilityData.name || abilityId}\n${
  //         //   abilityData.description || ""
  //         // }`;

  //         // --- Create Icon Element ---
  //         const iconElement = document.createElement("div");
  //         iconElement.classList.add("ability-icon");

  //         if (abilityData.iconSvgPath) {
  //           // Option 1: Use <img> tag (Simpler, good for external SVGs)
  //           const img = document.createElement("img");
  //           img.src = abilityData.iconSvgPath;
  //           img.alt = abilityData.name; // Good for accessibility
  //           img.style.width = "80%"; // Adjust size as needed via CSS preferably
  //           img.style.height = "80%";
  //           img.style.objectFit = "contain";
  //           iconElement.appendChild(img);

  //           // Embed SVG using fetch (Better for inline styling/manipulation, more complex)
  //           /*
  //                 fetch(abilityData.iconSvgPath)
  //                     .then(response => {
  //                         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  //                         return response.text();
  //                     })
  //                     .then(svgData => {
  //                         // Sanitize SVG data here if necessary before setting innerHTML
  //                         iconElement.innerHTML = svgData;
  //                         // Optional: Find SVG root and set width/height/fill via JS if needed
  //                         const svgElement = iconElement.querySelector('svg');
  //                         if (svgElement) {
  //                             svgElement.setAttribute('width', '80%');
  //                             svgElement.setAttribute('height', '80%');
  //                             // svgElement.style.fill = 'currentColor'; // Inherit text color
  //                         }
  //                     })
  //                     .catch(e => {
  //                         console.error(`Failed to load SVG icon for ${abilityId}:`, e);
  //                         iconElement.textContent = abilityData.iconPlaceholder || "?"; // Fallback
  //                     });
  //                 */
  //         } else {
  //           // Fallback to placeholder text if no SVG path
  //           iconElement.textContent = abilityData.iconPlaceholder || "?";
  //         }
  //         slot.appendChild(iconElement);

  //         // --- Create Hotkey Element (Only on icon update) ---
  //         const hotkeyElement = document.createElement("span");
  //         hotkeyElement.classList.add("hotkey-number");
  //         hotkeyElement.textContent = String(index + 1); // Use index for 1, 2, 3, 4
  //         slot.appendChild(hotkeyElement);
  //       } else {
  //         // Slot is empty, ensure it's visually cleared (already done by innerHTML = "")
  //         slot.classList.remove("ready");
  //         // slot.removeAttribute("title"); // Ensure empty slots have no title
  //       }
  //       // } else if (abilityData && !slot.title) {
  //       //   //  check: If icon didn't update BUT title is missing, add it back
  //       //   // This covers cases where the title might be cleared unexpectedly
  //       //   slot.title = `${abilityData.name || abilityId}\n${
  //       //     abilityData.description || ""
  //       //   }`;
  //     }

  //     // --- Attach Tooltip IF ability exists ---
  //     if (abilityData) {
  //       const getTooltipContent = () => {
  //         // Build tooltip content dynamically
  //         let tooltip = `${abilityData.name || abilityId}\n`;
  //         if (abilityData.description) {
  //           tooltip += `${abilityData.description}\n`;
  //         }
  //         if (abilityData.cooldownSeconds) {
  //           tooltip += `Cooldown: ${abilityData.cooldownSeconds}s`;
  //         }
  //         // Add other info like mana cost if applicable
  //         return tooltip.trim();
  //       };
  //       this.tooltipHelper.attach(slot, getTooltipContent); // <<< Attach tooltip
  //     }
  //     // --- End Tooltip Block ---

  //     // --- Update Cooldown Overlay (Always run this part) ---
  //     const overlay = slot.querySelector(".cooldown-overlay"); // Try to find existing overlay

  //     if (abilityData) {
  //       const remainingCooldown =
  //         abilityComponent.cooldowns.get(abilityId) || 0;
  //       const totalCooldown = abilityData.cooldownSeconds || 1;
  //       const isReady = remainingCooldown <= 0;

  //       slot.classList.toggle("ready", isReady); // Use toggle for cleaner add/remove

  //       if (!isReady) {
  //         let currentOverlay = overlay;
  //         if (!currentOverlay) {
  //           // Create overlay if it doesn't exist
  //           currentOverlay = document.createElement("div");
  //           currentOverlay.classList.add("cooldown-overlay");
  //           slot.appendChild(currentOverlay); // Append only once
  //         }
  //         const cooldownPercent = remainingCooldown / totalCooldown;
  //         currentOverlay.style.height = `${Math.max(
  //           0,
  //           Math.min(100, cooldownPercent * 100)
  //         )}%`;
  //         currentOverlay.textContent = remainingCooldown.toFixed(1);
  //       } else {
  //         if (overlay) {
  //           // Remove overlay if it exists and ability is ready
  //           overlay.remove();
  //         }
  //       }
  //     } else {
  //       // Ensure no overlay if slot is empty
  //       if (overlay) overlay.remove();
  //     }
  //   }); // End forEach slot
  // }

  updateActionBar(abilityComponent) {
    if (!this.actionSlots || !abilityComponent || !this.tooltipHelper) return;

    const knownAbilities = abilityComponent.getKnownAbilitiesArray();

    this.actionSlots.forEach((slot, index) => {
      const newAbilityId = knownAbilities[index]; // The ability that *should* be in the slot
      const currentAbilityIdInSlot = slot.dataset.abilityId; // The ability currently *represented* in the slot's data

      // --- Determine if Ability or Icon needs update ---
      const abilityChanged = newAbilityId !== currentAbilityIdInSlot;
      let needsIconUpdate =
        abilityChanged || !slot.querySelector(".ability-icon"); // Update icon if ability changed OR icon missing

      const abilityData = newAbilityId ? getAbilityData(newAbilityId) : null;

      // --- Update Icon ---
      if (needsIconUpdate) {
        slot.innerHTML = ""; // Clear previous content
        slot.dataset.abilityId = newAbilityId || ""; // Update stored ID *before* potential tooltip attach

        if (abilityData) {
          // Create Icon Element
          const iconElement = document.createElement("div");
          iconElement.classList.add("ability-icon");
          if (abilityData.iconSvgPath) {
            const img = document.createElement("img");
            img.src = abilityData.iconSvgPath;
            img.alt = abilityData.name;
            img.style.width = "80%";
            img.style.height = "80%";
            img.style.objectFit = "contain"; // Optional inline styles
            iconElement.appendChild(img);
          } else {
            iconElement.textContent = abilityData.iconPlaceholder || "?";
          }
          slot.appendChild(iconElement);

          // Create Hotkey Element
          const hotkeyElement = document.createElement("span");
          hotkeyElement.classList.add("hotkey-number");
          hotkeyElement.textContent = String(index + 1);
          slot.appendChild(hotkeyElement);
        } else {
          // Slot is becoming empty
          slot.classList.remove("ready");
        }
      }

      // --- Update Tooltip Listener (ONLY if ability changed)
      if (abilityChanged) {
        this.tooltipHelper.detach(slot); // Detach old listener first

        if (abilityData) {
          // Only attach if there's a new ability
          const getTooltipContent = () => {
            let tooltip = `${abilityData.name || newAbilityId}\n`;
            if (abilityData.description) {
              tooltip += `${abilityData.description}\n`;
            }
            if (abilityData.cooldownSeconds) {
              tooltip += `Cooldown: ${abilityData.cooldownSeconds}s`;
            }
            return tooltip.trim();
          };
          this.tooltipHelper.attach(slot, getTooltipContent);
        }
        // If !abilityData (slot became empty), detach was already called, no need to attach.
      }
      // --- End Tooltip Update ---

      // --- Update Cooldown Overlay (Always run this part, as cooldowns change frequently) ---
      const overlay = slot.querySelector(".cooldown-overlay");
      if (abilityData) {
        // Use abilityData based on the NEW ability ID
        const remainingCooldown =
          abilityComponent.cooldowns.get(newAbilityId) || 0;
        const totalCooldown = abilityData.cooldownSeconds || 1;
        const isReady = remainingCooldown <= 0;
        slot.classList.toggle("ready", isReady);

        if (!isReady) {
          // cooldown overlay rendering logic
          let currentOverlay = overlay;
          if (!currentOverlay) {
            currentOverlay = document.createElement("div");
            currentOverlay.classList.add("cooldown-overlay");
            slot.appendChild(currentOverlay);
          }
          const cooldownPercent = remainingCooldown / totalCooldown;
          currentOverlay.style.height = `${Math.max(
            0,
            Math.min(100, cooldownPercent * 100)
          )}%`;
          currentOverlay.textContent = remainingCooldown.toFixed(1);
        } else {
          if (overlay) {
            overlay.remove();
          }
        }
      } else {
        // Ensure no overlay if slot is empty
        if (overlay) overlay.remove();
      }
    }); // End forEach slot
  }

  /** Handles the hide chat button */
  toggleChatDisplay() {
    if (this.chatElement) {
      this.chatElement.style.display =
        this.chatElement.style.display === "none" ? "block" : "none";
    }
  }

  /**
   * Sets the text and visibility of the static interaction prompt.
   * @param {string} text - The text to display (e.g., "[E] Collect Stone"). If empty/null, hides the prompt.
   */
  setInteractionPrompt(text) {
    if (!this.interactionPromptElement) return;

    if (text && text.trim().length > 0) {
      this.interactionPromptElement.textContent = text;
      this.interactionPromptElement.style.display = "block"; // Or 'inline-block' etc.
      this.interactionPromptElement.classList.remove("hidden"); // Use opacity transition
    } else {
      // Hide it smoothly
      this.interactionPromptElement.classList.add("hidden");
      // Optionally set display to none after transition ends, if needed
      // setTimeout(() => {
      //     if (this.interactionPromptElement.classList.contains('hidden')) {
      //         this.interactionPromptElement.style.display = 'none';
      //     }
      // }, 200); // Match CSS transition duration
    }
  }

  /** Handles the inventoryChanged event */
  handleInventoryChange(eventData) {
    // Update the display only if it's currently visible
    if (this.isInventoryVisible) {
      // eventData might contain the inventory component directly { inventory: inventoryComp }
      this.updateInventoryDisplay(eventData?.inventory);
    }
  }

  // Handler ---
  handleInventoryOrCraftingUpdate() {
    const playerInventory =
      this.gameInstance?.playerController?.player?.userData?.inventory;
    if (this.isInventoryVisible) {
      // Only update if visible
      this.updateInventoryDisplay(playerInventory);
      this.updateCraftingMenu();
    }
    // Update stats display if character sheet is open, as inventory weight might affect things
    if (this.isCharacterSheetVisible) {
      this.updateCharacterStatsDisplay();
    }
  }

  updateCraftingMenu() {
    if (!this.craftingRecipesList || !this.gameInstance?.craftingSystem) {
      return;
    }

    const craftingSystem = this.gameInstance.craftingSystem;
    this.craftingRecipesList.innerHTML = ""; // Clear previous list items

    // Iterate through all defined recipes
    for (const recipeId in CRAFTING_RECIPES) {
      const recipe = CRAFTING_RECIPES[recipeId];
      const outputItemData = getItemData(recipe.outputItemId);
      if (!outputItemData) continue; // Skip if output item is invalid

      const listItem = document.createElement("li");
      const button = document.createElement("button");
      const craftingIcon = document.createElement("img");

      const canCraftNow = craftingSystem.canCraft(recipe.outputItemId);

      button.textContent = outputItemData.name || recipe.outputItemId; // Display item name
      // Optional: Add ingredients to tooltip
      // let tooltip = `Craft ${outputItemData.name}\nRequires:`;
      // recipe.ingredients.forEach((ing) => {
      //   const ingData = getItemData(ing.itemId);
      //   tooltip += `\n- ${ing.quantity}x ${ingData?.name || ing.itemId}`;
      // });
      // button.title = tooltip;

      // --- Tooltip Content Generation ---
      const getTooltipContent = () => {
        let tooltip = `Craft ${outputItemData.name}\nRequires:`;
        recipe.ingredients.forEach((ing) => {
          const ingData = getItemData(ing.itemId);
          tooltip += `\n- ${ing.quantity}x ${ingData?.name || ing.itemId}`;
        });
        // Add output item description
        if (outputItemData.description) {
          tooltip += `\n\n${outputItemData.description}`;
        }
        return tooltip;
      };
      // button.title = tooltip; // <<< REMOVE this line
      this.tooltipHelper.attach(button, getTooltipContent); //  this line
      // --- End Modification ---

      button.disabled = !canCraftNow; // Disable if cannot craft

      button.onclick = () => {
        craftingSystem.craftItem(recipe.outputItemId);
        // No need to manually update UI here, inventoryChanged event will trigger handleInventoryOrCraftingUpdate
      };

      craftingIcon.src = recipe.iconSvgPath || "";

      listItem.appendChild(button);
      listItem.appendChild(craftingIcon);
      this.craftingRecipesList.appendChild(listItem);
    }
  }

  /** Toggles the visibility of the inventory panel */
  toggleInventoryDisplay() {
    if (!this.inventoryPanel || !this.craftingMenuElement) return; // Check crafting menu too

    this.isInventoryVisible = !this.isInventoryVisible;
    const displayStyle = this.isInventoryVisible ? "grid" : "none";
    const craftingMenuStyle = this.isInventoryVisible ? "block" : "none"; // Display style for crafting menu

    this.inventoryPanel.style.display = displayStyle;
    this.craftingMenuElement.style.display = craftingMenuStyle; // <<< Show/hide crafting menu

    if (this.isInventoryVisible) {
      const playerInventory =
        this.gameInstance?.playerController?.player?.userData?.inventory;
      this.updateInventoryDisplay(playerInventory);
      this.updateCraftingMenu(); // <<< Update crafting menu when opening
    }
    this.log(`Inventory ${this.isInventoryVisible ? "Opened" : "Closed"}`);
  }

  /** Updates the inventory slot elements based on player inventory data (now an Array) */
  updateInventoryDisplay(inventoryComponent) {
    if (!this.inventorySlots || !inventoryComponent) {
      this.inventorySlots?.forEach((slot) => {
        this.tooltipHelper.detach(slot); // <<< Detach old tooltip before clearing
        this.clearSlot(slot);
      });
      return;
    }

    const itemsArray = inventoryComponent.items; // <<<< Use the array directly

    this.inventorySlots.forEach((slot, index) => {
      this.tooltipHelper.detach(slot); // <<< Detach listener from potentially old element
      if (index < itemsArray.length) {
        // Get stack data from the array
        const itemStack = itemsArray[index];
        // Pass the item details object and quantity to updateSlot
        this.updateSlot(slot, itemStack.item, itemStack.quantity, index); // <<<< Use itemStack.item
      } else {
        // This slot is empty
        this.clearSlot(slot);
      }
    });

    // Optional: Update weight display here as well
    const weightText = document.getElementById("inventory-weight");
    if (weightText) {
      weightText.textContent = `Weight: ${inventoryComponent
        .getTotalWeight()
        .toFixed(1)} / ${inventoryComponent.getMaxWeight()}`;
    }
  }

  updateSlot(slotElement, item, quantity, inventoryIndex) {
    // item is {id, name}
    slotElement.classList.remove("empty");
    slotElement.innerHTML = "";

    const fullItemData = getItemData(item.id); // Get full data

    // --- Tooltip Content Generation Function ---
    const getTooltipContent = () => {
      let tooltipText = "";
      if (fullItemData) {
        tooltipText += fullItemData.name || item.id;
        if (fullItemData.description) {
          tooltipText += `\n${fullItemData.description}`;
        }
        if (typeof fullItemData.weight === "number") {
          tooltipText += `\nWeight: ${fullItemData.weight.toFixed(1)}`;
        }
        if (
          typeof fullItemData.maxStack === "number" &&
          fullItemData.maxStack > 1
        ) {
          tooltipText += ` (Max: ${fullItemData.maxStack})`;
        }
        if (
          fullItemData.type === "consumable" &&
          typeof fullItemData.healAmount === "number"
        ) {
          tooltipText += `\nHeals: ${fullItemData.healAmount} HP`;
        }
        if (fullItemData.type === "equipment" && fullItemData.statsBonus) {
          tooltipText += `\nBonuses:`;
          for (const statKey in fullItemData.statsBonus) {
            /* ... format bonuses ... */ const bonusValue =
              fullItemData.statsBonus[statKey];
            let formattedStat = statKey.replace(/([A-Z])/g, " $1");
            formattedStat =
              formattedStat.charAt(0).toUpperCase() + formattedStat.slice(1);
            if (statKey.toLowerCase().includes("resistance")) {
              tooltipText += `\n  +${Math.round(
                bonusValue * 100
              )}% ${formattedStat}`;
            } else if (statKey.toLowerCase() === "damage") {
              tooltipText += `\n  +${bonusValue} Damage`;
            } else if (statKey.toLowerCase() === "maxhealth") {
              tooltipText += `\n  +${bonusValue} Max Health`;
            } else {
              tooltipText += `\n  +${bonusValue} ${formattedStat}`;
            }
          }
        }
      } else {
        tooltipText = item.name || item.id;
      }
      return tooltipText.trim();
    };
    // --- Attach Tooltip ---
    this.tooltipHelper.attach(slotElement, getTooltipContent);

    const buttonsDiv = document.createElement("div");
    buttonsDiv.style.position = "absolute";
    buttonsDiv.style.bottom = "1px";
    buttonsDiv.style.left = "1px";
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.gap = "2px";
    buttonsDiv.style.pointerEvents = "auto";
    slotElement.appendChild(buttonsDiv);

    const dropButton = document.createElement("button");
    dropButton.textContent = "D";
    dropButton.title = "Drop 1";
    dropButton.classList.add("item-button");
    dropButton.style.color = "#ff0000"; // Red
    dropButton.onclick = (event) => {
      /* ... drop logic ... */
      event.stopPropagation();
      const playerInventory =
        this.gameInstance?.playerController?.player?.userData?.inventory;
      if (playerInventory) playerInventory.dropItem(item.id, 1);
    };
    buttonsDiv.appendChild(dropButton);

    if (fullItemData?.type === "consumable") {
      const useButton = document.createElement("button");
      useButton.textContent = "Use";
      useButton.title = `Use ${item.name}`;
      useButton.classList.add("item-button");
      useButton.style.color = "#00ff00"; // Green
      useButton.onclick = (event) => {
        /* ... use logic ... */
        event.stopPropagation();
        eventBus.emit("useConsumableItem", { itemId: item.id });
      };
      buttonsDiv.appendChild(useButton);
    }

    // --- ADD Equip Button Logic ---
    if (fullItemData?.type === "equipment") {
      const equipButton = document.createElement("button");
      equipButton.textContent = "E"; // 'E' for Equip
      equipButton.title = `Equip ${item.name}`;
      equipButton.classList.add("item-button");
      equipButton.style.color = "#00ff00"; // Green

      // Check if item can be equipped (is something already in that slot?)
      const equipmentComp =
        this.gameInstance?.playerController?.player?.userData?.equipment;
      const targetSlot = fullItemData.equipSlot;
      //  const isSlotFilled = equipmentComp?.getEquippedItem(targetSlot) !== null;
      // Disable button? Maybe allow swapping later. For now, just add it.

      equipButton.onclick = (event) => {
        event.stopPropagation();
        // Get equipment component and call equipItem
        const equipment =
          this.gameInstance?.playerController?.player?.userData?.equipment;
        if (equipment) {
          console.log(
            `UI attempting to equip item ID: ${item.id} from inventory index: ${inventoryIndex}`
          ); // Log index
          equipment.equipItem(item.id, inventoryIndex);
          // UI update handled by equipmentChanged event
        } else {
          console.error(
            "Cannot equip: EquipmentComponent not found on player."
          );
        }
      };
      buttonsDiv.appendChild(equipButton);
    }

    // --- Place Button (Placeable) ---
    if (fullItemData?.type === "placeable") {
      const placeButton = document.createElement("button");
      placeButton.textContent = "P"; // 'P' for Place
      placeButton.title = `Place ${item.name}`;
      placeButton.classList.add("item-button");
      placeButton.style.color = "#00ff00"; // Green
      placeButton.onclick = (event) => {
        event.stopPropagation();
        // Emit event for PlacementSystem to handle
        eventBus.emit("placeItemAttempt", { itemId: item.id });
      };
      buttonsDiv.appendChild(placeButton);
    }

    // --- Icon ---
    if (fullItemData?.iconImagePath) {
      const imgElement = document.createElement("img");
      imgElement.src = fullItemData.iconImagePath;
      imgElement.alt = item.name || item.id; // Alt text for accessibility
      imgElement.classList.add("item-icon"); // Add class for styling
      // Optional: Set loading='lazy' if you have many icons
      // imgElement.loading = 'lazy';
      slotElement.appendChild(imgElement); // Append the image
    } else {
      // Fallback if no iconImagePath is defined
      const fallbackIcon = document.createElement("div");
      fallbackIcon.classList.add("item-icon");
      fallbackIcon.textContent = item.id.substring(0, 2).toUpperCase(); // Original fallback
      slotElement.appendChild(fallbackIcon);
      console.warn(`Missing iconImagePath for item: ${item.id}`);
    }
    // --- End Icon Section ---

    if (quantity > 1) {
      // ... quantity logic ...
      const quantityElement = document.createElement("div");
      quantityElement.classList.add("item-quantity");
      quantityElement.textContent = quantity;
      slotElement.appendChild(quantityElement);
    }
  }

  // Handler for entity health changes
  handleEntityHealthChange(eventData) {
    const { healthComponent, target } = eventData; // Get component and target ref
    const targetName = target?.name || eventData?.instanceId || "Target"; // Get name

    if (!healthComponent) return;

    // Check if this is the component currently tracked by the UI bar
    if (this.trackedHealthComponent === healthComponent) {
      // If it's the one we are already showing, just update and reset timer
      this.updateTargetHealth();
      this._resetAutoHideTimer();
    } else {
      // If it's a different entity taking damage, show its health bar
      this.showTargetHealth(healthComponent, targetName);
      // showTargetHealth already updates and resets the timer
    }
  }

  //  Method to create FPS counter element >>>
  createFpsCounterElement() {
    let fpsElement = document.getElementById("fps-counter");
    if (!fpsElement) {
      fpsElement = document.createElement("div");
      fpsElement.id = "fps-counter";
      fpsElement.textContent = "FPS: --";
      // Append it somewhere sensible, e.g., top-left or near debug controls
      // Option 1: Append to body (simplest)
      document.body.appendChild(fpsElement);
      // Option 2: Append to a specific UI container if you have one
      // const uiContainer = document.getElementById('ui-container');
      // uiContainer?.appendChild(fpsElement);
      console.log("UIManager: FPS counter element created.");
    }
    return fpsElement;
  }

  //  Method to update FPS counter text >>>
  updateFpsCounter(element, fps) {
    if (element) {
      element.textContent = `FPS: ${fps}`;
    }
  }

  /** Clears a single inventory slot */
  clearSlot(slotElement) {
    this.tooltipHelper.detach(slotElement); // <<< Detach tooltip when clearing
    slotElement.classList.add("empty");
    slotElement.innerHTML = ""; // Remove icon and quantity
    slotElement.title = ""; // Clear tooltip
  }

  /** Shows or updates the target health bar for a specific component */
  showTargetHealth(healthComponent, targetName = "Target") {
    if (!this.targetHealthBarContainer || !healthComponent) return;

    // Check if it's the same target or a new one
    const isNewTarget = this.trackedHealthComponent !== healthComponent;
    this.trackedHealthComponent = healthComponent; // Store reference

    if (isNewTarget) {
      // Make bar visible and set label only if it's a new target
      this.targetHealthBarContainer.style.display = "block";
      if (this.targetHealthBarLabel) {
        this.targetHealthBarLabel.textContent = targetName;
      }
    }
    // Always update fill percentage
    this.updateTargetHealth(); // Call update after setting/confirming target
    // Always reset auto-hide timer
    this._resetAutoHideTimer();
  }

  /** Updates the fill percentage of the currently displayed health bar */
  updateTargetHealth() {
    if (
      !this.targetHealthBarFill ||
      !this.trackedHealthComponent
      // Removed health check here, let showTargetHealth decide if bar should show
    ) {
      return;
    }

    // Check if health is valid before calculating percentage
    if (this.trackedHealthComponent.currentHealth < 0) {
      // Optionally hide immediately if health <= 0?
      this.hideTargetHealth();
      return;
    }

    // Ensure maxHealth is positive to avoid division by zero or NaN
    const maxHealth =
      this.trackedHealthComponent.maxHealth > 0
        ? this.trackedHealthComponent.maxHealth
        : 1;
    const healthPercent =
      (this.trackedHealthComponent.currentHealth / maxHealth) * 100;

    // Check if fill element exists before setting style
    if (this.targetHealthBarFill) {
      this.targetHealthBarFill.style.width = `${Math.max(0, healthPercent)}%`;
    }
  }

  /** Hides the target health bar */
  hideTargetHealth() {
    if (this.targetHealthBarContainer) {
      this.targetHealthBarContainer.style.display = "none";
    }
    this.trackedHealthComponent = null; // Clear reference
    if (this.hideHealthBarTimeout) {
      clearTimeout(this.hideHealthBarTimeout); // Clear timer
      this.hideHealthBarTimeout = null;
    }
  }

  /** Resets the timer that automatically hides the health bar */
  _resetAutoHideTimer() {
    if (this.hideHealthBarTimeout) {
      clearTimeout(this.hideHealthBarTimeout);
    }
    // Only set timer if component is being tracked
    if (this.trackedHealthComponent) {
      this.hideHealthBarTimeout = setTimeout(() => {
        this.hideTargetHealth();
      }, this.healthBarVisibleDuration);
    }
  }

  /** Handles click on the Unstuck button */
  onUnstuckClick() {
    // METHOD
    console.log("Unstuck button clicked.");
    if (this.gameInstance) {
      this.gameInstance.resetPlayerPosition(); // Call method on Game instance
    } else {
      console.error(
        "UIManager: Cannot unstuck player, Game reference missing."
      );
    }
  }

  /**
   * Toggles the visibility of the physics debug wireframes.
   * Called when the debug toggle button is clicked.
   */
  toggleDebugView() {
    if (this.physicsEngineRef) {
      this.physicsEngineRef.toggleDebug(); // Call the physics engine's toggle method
      this.updateDebugButtonText(); // Update button text after toggling
    } else {
      console.error(
        "UIManager: Cannot toggle debug view, PhysicsEngine reference missing."
      );
    }
  }

  /** Updates the text on the debug toggle button based on current visibility */
  updateDebugButtonText() {
    if (this.physicsEngineRef && this.debugToggleButton) {
      const isVisible = this.physicsEngineRef.debugGroup.visible;
      this.debugToggleButton.textContent = isVisible
        ? "Hide Helper (P)"
        : "Show Helper (P)";
    }
  }

  // might add a separate log.
  // one for all logs, one for specific logs.
  // target a different chat element with each?
  // or just use the same element?

  /**
   * Adds a message to the debug log area on the screen.
   * (Placeholder - currently just logs to console)
   * @param {string} message - The message string to log.
   */
  log(message, color = null) {
    // TODO: Implement appending message to the this.debugLogArea element
    console.log(`UI LOG: ${message}`);

    if (this.debugLogArea) {
      const logEntry = document.createElement("p");
      const timestamp = new Date().toLocaleTimeString([], { hour12: false });
      logEntry.textContent = `[${timestamp}] ${message}`;

      // --- Apply Color ---
      if (color) {
        // Option 1: Using specific classes (Recommended for predefined colors)
        // Add classes like 'log-red', 'log-green', etc. based on the color string
        // logEntry.classList.add(`log-${color.toLowerCase()}`);

        // Option 2: Applying inline style (More flexible for any CSS color)
        logEntry.style.color = color;
      }
      // --- End Apply Color ---

      this.debugLogArea.appendChild(logEntry);

      // Auto-scroll to the bottom
      this.debugLogArea.scrollTop = this.debugLogArea.scrollHeight;

      // Optional: Limit number of log entries
      const maxEntries = 50;
      if (this.debugLogArea.childElementCount > maxEntries + 1) {
        this.debugLogArea.removeChild(this.debugLogArea.children[1]);
      }
    }
  }

  /**
   * Updates UI elements that need refreshing every frame (if any).
   * @param {object} [gameState] - Optional object containing current game state (e.g., inventory, player stats).
   */
  update(gameState) {
    // Update action bar every frame, passing the player's ability component
    const playerAbilityComp =
      this.gameInstance?.playerController?.player?.userData?.abilityComponent;
    if (playerAbilityComp) {
      this.updateActionBar(playerAbilityComp); // <<< Update Action Bar
    }
    // Note: Player health bar is now updated via event emitter 'playerHealthChanged'
    // No need to poll it here every frame.
    // --- Update Player Coordinates Display ---  THIS BLOCK
    if (
      this.coordsDisplayElement &&
      this.gameInstance?.playerController?.player
    ) {
      const playerWorldPos = new THREE.Vector3();
      this.gameInstance.playerController.player.getWorldPosition(
        playerWorldPos
      ); // Get current world position
      this.updateCoordsDisplay(this.coordsDisplayElement, playerWorldPos);
    }
  }

  /** Handles window resize events for UI adjustments  */
  onResize() {
    // TODO: Recalculate positions or sizes of UI elements if they aren't purely CSS-based
    console.log("UIManager handling resize (placeholder)");
  }
}

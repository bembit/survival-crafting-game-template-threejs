// src/systems/ConsumableSystem.js
import { getItemData } from "../config/ItemConfig.js";
import eventBus from "../core/EventBus.js";

export class ConsumableSystem {
  /** @type {import('../Game.js').Game} */
  gameInstance; // Reference to get player components

  constructor(gameInstance) {
    this.gameInstance = gameInstance;

    eventBus.on("useConsumableItem", this.handleUseItem.bind(this));
    console.log(
      "ConsumableSystem initialized and listening for 'useConsumableItem'."
    );
  }

  handleUseItem(eventData) {
    const itemId = eventData?.itemId;
    const player = this.gameInstance?.playerController?.player;
    const inventory = player?.userData?.inventory;
    const health = player?.userData?.health;
    const uiManager = this.gameInstance?.uiManager;

    if (!itemId || !player || !inventory || !health || !uiManager) {
      console.error("ConsumableSystem: Missing data for using item", itemId);
      return;
    }

    const itemData = getItemData(itemId);
    if (!itemData || itemData.type !== "consumable") {
      console.warn(`Item ${itemId} is not a valid consumable.`);
      return;
    }

    // Check if player actually has the item
    if (!inventory.hasItem(itemId, 1)) {
      uiManager.log(`You don't have any ${itemData.name}s.`);
      console.warn(`Attempted to use ${itemId}, but player does not have it.`);
      return; // Should not happen if UI is correct, but good check
    }

    let effectApplied = false;

    // --- Apply Effects ---
    // Heal Effect
    if (itemData.healAmount && itemData.healAmount > 0) {
      if (health.currentHealth >= health.maxHealth) {
        uiManager.log("Your health is already full.");
      } else {
        const healValue = itemData.healAmount;
        health.heal(healValue); // Use the heal method in HealthComponent
        uiManager.log(
          `Used ${itemData.name}. Healed for ${healValue}.`,
          "green"
        );
        console.log(`Player used ${itemId}, healed ${healValue} HP.`);
        effectApplied = true;
      }
    }

    // Add other consumable effects here (e.g., temporary buffs)
    // else if (itemData.buff) { ... apply buff via StatsComponent ... }

    // --- Consume Item ---
    if (effectApplied) {
      const removedInfo = inventory.removeItem(itemId, 1);
      if (!removedInfo) {
        // This is strange if hasItem passed, log an error
        console.error(
          `ConsumableSystem: Failed to remove used item ${itemId} after effect application!`
        );
        // Maybe revert the effect? For healing, it's usually okay.
      }
      // UI updates via inventoryChanged event from removeItem
    }
  }

  // TODO: Add destroy method if needed (e.g., remove listener)
  destroy() {
    eventBus.off("useConsumableItem", this.handleUseItem.bind(this));
    console.log("ConsumableSystem destroyed.");
  }
}

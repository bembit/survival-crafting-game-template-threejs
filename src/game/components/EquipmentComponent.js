// src/game/components/EquipmentComponent.js
import eventBus from "../../core/EventBus.js";
import { getItemData } from "../../config/ItemConfig.js";

export class EquipmentComponent {
  /** @type {import('./InventoryComponent.js').InventoryComponent | null} */
  inventoryRef = null; // Reference to the player's inventory
  /** @type {import('./StatsComponent.js').StatsComponent | null} */
  statsRef = null; // Reference to the player's stats

  // Define slots - keys should match 'equipSlot' values in ItemConfig
  slots = {
    head: null, // Stores { itemId, itemData } or null
    chest: null,
    legs: null,
    feet: null,
    gloves: null,
    bag: null,
    weapon: null,
  };

  // Pass references to related components on creation
  constructor(inventoryComponent, statsComponent) {
    this.inventoryRef = inventoryComponent;
    this.statsRef = statsComponent;
    console.log("EquipmentComponent initialized.");
  }

  /** Checks if a slot name is valid */
  isValidSlot(slot) {
    return Object.prototype.hasOwnProperty.call(this.slots, slot);
  }

  /** Gets the item currently equipped in a specific slot */
  getEquippedItem(slot) {
    return this.isValidSlot(slot) ? this.slots[slot] : null;
  }

  /**
   * Attempts to equip an item from inventory to a specific slot.
   * @param {string} itemIdToEquip - The ID of the item in inventory.
   * @param {number} inventoryIndex - The index of the item stack in the inventory array.
   * @returns {boolean} True if successful, false otherwise.
   */
  equipItem(itemIdToEquip, inventoryIndex) {
    if (!this.inventoryRef || !this.statsRef) return false;

    // 1. Get item data from inventory stack
    const itemStack = this.inventoryRef.items[inventoryIndex];
    if (!itemStack || itemStack.itemId !== itemIdToEquip) {
      console.warn(
        `Equip failed: Item ${itemIdToEquip} not found at inventory index ${inventoryIndex}`
      );
      return false;
    }
    const itemData = getItemData(itemStack.itemId);

    // 2. Validate item type and slot
    if (
      !itemData ||
      itemData.type !== "equipment" ||
      !this.isValidSlot(itemData.equipSlot)
    ) {
      console.warn(
        `Equip failed: ${itemIdToEquip} is not valid equipment for slot ${itemData?.equipSlot}.`
      );
      return false;
    }
    const targetSlot = itemData.equipSlot;

    // 3. Check if something is already equipped in the target slot
    const currentlyEquipped = this.slots[targetSlot];

    // 4. Remove the item to be equipped from inventory (remove 1)
    const removedItemInfo = this.inventoryRef.removeItem(itemIdToEquip, 1);
    if (!removedItemInfo) {
      console.error(
        `Equip failed: Could not remove ${itemIdToEquip} from inventory (should not happen if UI is correct).`
      );
      return false; // Should not happen if checks are done right
    }

    // 5. If an item was equipped, unequip it first (move it back to inventory)
    if (currentlyEquipped) {
      // Use internal unequip logic BUT skip removing from slot yet
      this._handleUnequipEffects(currentlyEquipped.itemId, targetSlot);
      // Add the previously equipped item back to inventory
      // Important: Add it *after* removing the new item to avoid slot/weight issues if swapping same item type
      const addedBack = this.inventoryRef.addItem(currentlyEquipped.itemId, 1);
      if (!addedBack) {
        console.error(
          `Equip failed: Could not add UNEQUIPPED item ${currentlyEquipped.itemId} back to inventory!`
        );
        // Critical failure - try to put the item we removed back? Rollback needed.
        this.inventoryRef.addItem(removedItemInfo.itemId, 1); // Attempt rollback
        return false;
      }
    }

    // 6. Place the new item in the slot
    // Store minimal data needed (don't store the full itemData again if not necessary)
    this.slots[targetSlot] = {
      itemId: itemData.id,
      name: itemData.name /* add other needed display props */,
    };

    // 7. Apply new item's effects/stats
    this._handleEquipEffects(itemData, targetSlot);

    console.log(`Equipped ${itemData.name} to ${targetSlot} slot.`);
    eventBus.emit("equipmentChanged", { component: this }); // Notify UI
    // Inventory event is emitted by removeItem/addItem internally
    return true;
  }

  /**
   * Unequips item from a slot and returns it to inventory.
   * @param {string} slot - The slot name to unequip from.
   * @returns {boolean} True if successful, false otherwise.
   */
  unequipItem(slot) {
    if (
      !this.isValidSlot(slot) ||
      !this.slots[slot] ||
      !this.inventoryRef ||
      !this.statsRef
    ) {
      return false; // Slot invalid, empty, or missing refs
    }

    const itemToUnequip = this.slots[slot]; // { itemId, name }

    // 1. Check if inventory has space/weight
    const itemData = getItemData(itemToUnequip.itemId);
    if (!itemData) {
      console.error(
        `Unequip Error: Cannot get item data for ${itemToUnequip.itemId}`
      );
      return false; // Should not happen
    }
    if (
      this.inventoryRef.currentWeight + (itemData.weight || 0) >
      this.inventoryRef.maxWeight
    ) {
      console.warn(
        `Unequip failed: Not enough inventory weight capacity for ${itemData.name}.`
      );
      this.gameInstance?.uiManager?.log(
        "Cannot unequip: Inventory overweight."
      );
      return false;
    }
    // Simple slot check (add more robust check if needed)
    if (
      this.inventoryRef.items.length >= this.inventoryRef.size &&
      !this.inventoryRef.hasItem(itemToUnequip.itemId, itemData.maxStack - 1)
    ) {
      console.warn(
        `Unequip failed: Inventory slots full for ${itemData.name}.`
      );
      this.gameInstance?.uiManager?.log(
        "Cannot unequip: Inventory slots full."
      );
      return false;
    }

    // 2. Remove item's effects/stats
    this._handleUnequipEffects(itemToUnequip.itemId, slot);

    // 3. Add item back to inventory
    const addedBack = this.inventoryRef.addItem(itemToUnequip.itemId, 1);

    if (!addedBack) {
      console.error(
        `Unequip Error: Failed to add ${itemToUnequip.itemId} back to inventory!`
      );
      // Critical failure - Re-apply effects? This indicates a larger inventory issue.
      this._handleEquipEffects(itemData, slot); // Attempt rollback of effects
      return false;
    }

    // 4. Clear the slot
    this.slots[slot] = null;

    console.log(`Unequipped ${itemData.name} from ${slot} slot.`);
    eventBus.emit("equipmentChanged", { component: this }); // Notify UI
    // Inventory event emitted by addItem
    return true;
  }

  /** Internal: Applies stat bonuses */
  _handleEquipEffects(itemData, slot) {
    if (!itemData.statsBonus || !this.statsRef) return;

    console.log(`Applying stats for ${itemData.name}:`, itemData.statsBonus);
    for (const stat in itemData.statsBonus) {
      const bonusValue = itemData.statsBonus[stat];
      const statKeyLower = stat.toLowerCase();
      // <<< uniqueBonusId >>>
      const uniqueBonusId = `${itemData.id}_${slot}_${statKeyLower}`; // Include the stat key

      if (typeof this.statsRef.applyEquipmentBonus === "function") {
        this.statsRef.applyEquipmentBonus(
          statKeyLower,
          bonusValue,
          uniqueBonusId // <<< Unique ID
        );
      } else {
        console.warn(`StatsComponent missing applyEquipmentBonus method.`);
      }
    }
    // Important: Trigger stat recalculation after applying bonuses
    if (typeof this.statsRef.recalculateCurrentStats === "function") {
      this.statsRef.recalculateCurrentStats();
    }
    // Optionally trigger health update if maxHealth changed
    // >>> Revisit / State, load.
    // >>> Revisit / Helper for unique ids?
    if (
      itemData.statsBonus.maxHealth &&
      typeof this.statsRef.entityRef?.userData?.health?.updateMaxHealth ===
        "function"
    ) {
      this.statsRef.entityRef.userData.health.updateMaxHealth(
        this.statsRef.currentMaxHealth
      );
    }
  }

  /** Internal: Removes stat bonuses */
  _handleUnequipEffects(itemId, slot) {
    const itemData = getItemData(itemId);
    if (!itemData?.statsBonus || !this.statsRef) return;

    console.log(`Removing stats for ${itemData.name}:`, itemData.statsBonus);
    for (const stat in itemData.statsBonus) {
      const bonusValue = itemData.statsBonus[stat];
      const statKeyLower = stat.toLowerCase();
      // <<< uniqueBonusId >>>
      const uniqueBonusId = `${itemData.id}_${slot}_${statKeyLower}`; // Include the stat key

      if (typeof this.statsRef.removeEquipmentBonus === "function") {
        this.statsRef.removeEquipmentBonus(
          statKeyLower,
          bonusValue,
          uniqueBonusId // <<< unique ID
        );
      } else {
        console.warn(`StatsComponent missing removeEquipmentBonus method.`);
      }
    }
    // Important: Trigger stat recalculation after removing bonuses
    if (typeof this.statsRef.recalculateCurrentStats === "function") {
      this.statsRef.recalculateCurrentStats();
    }
    // Optionally trigger health update if maxHealth changed
    if (
      itemData.statsBonus.maxHealth &&
      typeof this.statsRef.entityRef?.userData?.health?.updateMaxHealth ===
        "function"
    ) {
      this.statsRef.entityRef.userData.health.updateMaxHealth(
        this.statsRef.currentMaxHealth
      );
    }
  }

  // Method to get all currently equipped items (for saving)
  getEquippedItemsState() {
    const state = {};
    for (const slot in this.slots) {
      if (this.slots[slot]) {
        state[slot] = this.slots[slot].itemId; // Save only the item ID
      } else {
        state[slot] = null;
      }
    }
    return state;
  }

  // Method to apply loaded state (needs careful ordering with inventory load)
  applyEquippedItemsState(loadedState) {
    if (!loadedState || !this.inventoryRef) return;
    console.log("Applying loaded equipment state:", loadedState);

    // Clear existing slots first *without* adding items back to inventory
    for (const slot in this.slots) {
      if (this.slots[slot]) {
        this._handleUnequipEffects(this.slots[slot].itemId, slot); // Remove stats
        this.slots[slot] = null; // Just clear slot
      }
    }

    // Attempt to equip items from the loaded state
    for (const slot in loadedState) {
      const itemId = loadedState[slot];
      if (itemId && this.isValidSlot(slot)) {
        // Find the item in the *already loaded* inventory
        // Note: This assumes inventory is loaded *before* equipment state is applied
        const inventoryStackIndex = this.inventoryRef.items.findIndex(
          (stack) => stack.itemId === itemId
        );

        if (inventoryStackIndex !== -1) {
          console.log(
            `Attempting to re-equip ${itemId} to ${slot} from inventory index ${inventoryStackIndex}`
          );
          const success = this.equipItem(itemId, inventoryStackIndex);
          if (!success) {
            console.error(
              `Failed to re-equip loaded item ${itemId} to slot ${slot}. It may remain in inventory.`
            );
          }
        } else {
          console.warn(
            `Loaded equipped item ${itemId} for slot ${slot} not found in loaded inventory.`
          );
          this.slots[slot] = null; // Ensure slot is empty if item not found
        }
      } else {
        this.slots[slot] = null; // Ensure slot is null if no item ID was saved
      }
    }
    eventBus.emit("equipmentChanged", { component: this }); // Final update after applying all
  }
}

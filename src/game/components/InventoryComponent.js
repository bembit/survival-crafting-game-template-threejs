// src/game/components/InventoryComponent.js
import eventBus from "../../core/EventBus.js";
import { getItemData } from "../../config/ItemConfig.js";

/**
 * Manages an entity's inventory using an Array to allow multiple stacks of the same item.
 */
export class InventoryComponent {
  /** @type {Array<{itemId: string, quantity: number, item: object}>} Array of item stacks. */
  items; // <<<< Note: changed from Map
  /** @type {number} Maximum number of inventory slots (stacks). */
  size;
  /** @type {number} Current total weight of items in inventory. */
  currentWeight = 0;
  /** @type {number} Maximum weight the inventory can hold. */
  maxWeight = 100;

  constructor(size = 16, maxWeight = 100) {
    this.items = []; // <<<< Initialize as Array
    this.size = size;
    this.maxWeight = maxWeight;
    this.currentWeight = 0;
    // No need to recalculate initial weight, it starts at 0
    console.log(`Inventory initialized: Size=${size}, MaxWeight=${maxWeight}`);
  }

  /** Recalculates the total weight of the inventory from the array */
  recalculateWeight() {
    this.currentWeight = 0;
    for (const stack of this.items) {
      // <<<< Iterate Array
      const itemData = getItemData(stack.itemId);
      if (itemData) {
        this.currentWeight += (itemData.weight || 0) * stack.quantity;
      }
    }
    // Ensure weight doesn't go negative due to float issues during removal
    this.currentWeight = Math.max(0, this.currentWeight);
    console.log(
      `Inventory weight recalculated: ${this.currentWeight.toFixed(2)} / ${
        this.maxWeight
      }`
    );
  }

  /**
   * Adds an item to the inventory. Handles stacking, weight, slots, and max stacks.
   * @returns {number} The number of items successfully added.
   */
  addItem(itemId, quantity = 1) {
    if (quantity <= 0 || !itemId) return 0;

    const itemData = getItemData(itemId);
    if (!itemData) {
      console.warn(`Inventory: Cannot add unknown item ID: ${itemId}`);
      return 0;
    }

    const itemWeight = itemData.weight || 0;
    const maxStack = itemData.maxStack || 99;
    let remainingQuantityToAdd = quantity;
    let successfullyAdded = 0;

    console.log(
      `Inventory: Attempting to add ${quantity} of ${itemId} (Weight: ${itemWeight}, MaxStack: ${maxStack})`
    );

    // --- Weight Check ---
    const availableWeight = this.maxWeight - this.currentWeight;
    const canAddByWeight =
      itemWeight > 0
        ? Math.floor(availableWeight / itemWeight)
        : remainingQuantityToAdd;

    if (canAddByWeight <= 0 && itemWeight > 0) {
      console.warn(`Inventory: Cannot add ${itemId}, overweight!`);
      // UI Log needed
      return 0;
    }
    if (itemWeight > 0 && canAddByWeight < remainingQuantityToAdd) {
      remainingQuantityToAdd = canAddByWeight;
      console.warn(
        `Inventory: Adding reduced quantity (${remainingQuantityToAdd}/${quantity}) of ${itemId} due to weight limit.`
      );
      // UI Log needed
    }

    // --- 1. Fill Existing Stacks ---
    for (const stack of this.items) {
      // <<<< Iterate Array
      if (stack.itemId === itemId && stack.quantity < maxStack) {
        const spaceInStack = maxStack - stack.quantity;
        const amountToAdd = Math.min(remainingQuantityToAdd, spaceInStack);

        if (amountToAdd > 0) {
          stack.quantity += amountToAdd;
          this.currentWeight += amountToAdd * itemWeight;
          remainingQuantityToAdd -= amountToAdd;
          successfullyAdded += amountToAdd;
          console.log(
            `Inventory: Added ${amountToAdd} to existing stack of ${itemId}. New total: ${stack.quantity}`
          );
        }
      }
      if (remainingQuantityToAdd <= 0) break; // Stop if done
    }

    // --- 2. Create New Stacks if Needed ---
    while (remainingQuantityToAdd > 0) {
      // Check SLOT capacity before creating a new stack
      if (this.items.length >= this.size) {
        // <<<< Check Array length
        console.warn("Inventory slots full! Cannot add new item stack.");
        // UI Log needed
        break;
      }

      const amountToAdd = Math.min(remainingQuantityToAdd, maxStack);
      if (amountToAdd > 0) {
        // Create a new stack object and push it to the array
        const newItemDataForStack = { id: itemData.id, name: itemData.name }; // Basic item info
        this.items.push({
          // <<<< Push new object to Array
          itemId: itemId,
          quantity: amountToAdd,
          item: newItemDataForStack,
        });

        this.currentWeight += amountToAdd * itemWeight;
        remainingQuantityToAdd -= amountToAdd;
        successfullyAdded += amountToAdd;
        console.log(
          `Inventory: Added NEW stack of ${itemId} with quantity ${amountToAdd}. Slots used: ${this.items.length}/${this.size}`
        );
      } else {
        break; // Safety break
      }
    }

    // --- Final Updates ---
    if (successfullyAdded > 0) {
      eventBus.emit("inventoryChanged", { inventory: this });
    }
    if (successfullyAdded < quantity) {
      console.warn(
        `Inventory: Could not add all ${quantity} of ${itemId}. Added: ${successfullyAdded}.`
      );
      // UI Log needed
    }
    console.log(
      `Inventory Weight after add: ${this.currentWeight.toFixed(2)} / ${
        this.maxWeight
      }`
    );
    return successfullyAdded;
  }

  /**
   * Removes a specified quantity of an item from the inventory, potentially across multiple stacks.
   * @returns {object | null} An object {itemId, quantity, itemData} representing the *total* removed items, or null if failed.
   */
  removeItem(itemId, quantity = 1) {
    if (quantity <= 0 || !itemId) return null;

    const itemData = getItemData(itemId); // Needed for weight and maybe itemData later
    if (!itemData) {
      console.warn(`Inventory: Cannot remove unknown item ID: ${itemId}`);
      return null;
    }
    const itemWeight = itemData.weight || 0;

    let quantityToRemove = quantity;
    let actuallyRemoved = 0;
    let removedItemBaseData = null; // To store the item details

    // Iterate backwards through the array to safely remove empty stacks using splice
    for (let i = this.items.length - 1; i >= 0; i--) {
      const stack = this.items[i];

      if (stack.itemId === itemId) {
        if (!removedItemBaseData) removedItemBaseData = stack.item; // Store item details once

        const amountToRemoveFromStack = Math.min(
          quantityToRemove,
          stack.quantity
        );

        if (amountToRemoveFromStack > 0) {
          stack.quantity -= amountToRemoveFromStack;
          this.currentWeight -= amountToRemoveFromStack * itemWeight;
          quantityToRemove -= amountToRemoveFromStack;
          actuallyRemoved += amountToRemoveFromStack;

          console.log(
            `Inventory: Removed ${amountToRemoveFromStack} from stack ${i} of ${itemId}. Stack remaining: ${stack.quantity}`
          );

          if (stack.quantity <= 0) {
            this.items.splice(i, 1); // Remove empty stack from array
            console.log(`Inventory: Removed empty stack ${i} for ${itemId}.`);
          }
        }
      }
      if (quantityToRemove <= 0) break; // Stop if we removed enough
    }

    if (actuallyRemoved > 0) {
      this.currentWeight = Math.max(0, this.currentWeight); // Ensure weight isn't negative
      eventBus.emit("inventoryChanged", { inventory: this });
      console.log(
        `Inventory: Total removed ${actuallyRemoved} of ${itemId}. Weight: ${this.currentWeight.toFixed(
          2
        )}`
      );
      // Return info based on what was actually removed
      return {
        itemId: itemId,
        quantity: actuallyRemoved,
        itemData: removedItemBaseData,
      };
    } else {
      console.warn(
        `Inventory: Could not find ${quantity} of ${itemId} to remove.`
      );
      return null; // None were removed
    }
  }

  /** Removes items and triggers drop event (no change needed here) */
  dropItem(itemId, quantity = 1) {
    console.log(`Inventory: Attempting to drop ${quantity} of ${itemId}`);
    const removedInfo = this.removeItem(itemId, quantity);

    if (removedInfo) {
      console.log(
        `Inventory: Successfully removed ${removedInfo.quantity} of ${removedInfo.itemId} for dropping.`
      );
      eventBus.emit("itemDropped", {
        itemId: removedInfo.itemId,
        quantity: removedInfo.quantity, // Quantity actually removed
        itemData: removedInfo.itemData,
      });
      return true;
    } else {
      console.warn(
        `Inventory: Failed to remove ${quantity} of ${itemId} for dropping.`
      );
      return false;
    }
  }

  /** Gets the current total weight of the inventory */
  getTotalWeight() {
    // Recalculate just to be safe, though incremental updates should be okay
    // this.recalculateWeight();
    return this.currentWeight;
  }

  /** Gets the maximum weight capacity */
  getMaxWeight() {
    return this.maxWeight;
  }

  /** Checks if the inventory contains at least a certain quantity of an item */
  hasItem(itemId, quantity = 1) {
    let totalQuantity = 0;
    for (const stack of this.items) {
      // <<<< Iterate Array
      if (stack.itemId === itemId) {
        totalQuantity += stack.quantity;
      }
    }
    return totalQuantity >= quantity;
  }
}

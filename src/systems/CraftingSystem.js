// src/systems/CraftingSystem.js
import { getRecipeData } from "../config/CraftingConfig.js";
import { getItemData } from "../config/ItemConfig.js";
// import eventBus from "../core/EventBus.js";

export class CraftingSystem {
  /** @type {import('../Game.js').Game} */
  gameInstance; // Reference to get player components

  constructor(gameInstance) {
    this.gameInstance = gameInstance;
    console.log("CraftingSystem initialized.");
  }

  /**
   * Checks if the player has enough ingredients to craft an item.
   * @param {string} outputItemId - The ID of the item to potentially craft.
   * @returns {boolean} True if the item can be crafted, false otherwise.
   */
  canCraft(outputItemId) {
    const recipe = getRecipeData(outputItemId);
    const inventory =
      this.gameInstance?.playerController?.player?.userData?.inventory;

    if (!recipe || !inventory) {
      return false; // No recipe or inventory
    }

    for (const ingredient of recipe.ingredients) {
      if (!inventory.hasItem(ingredient.itemId, ingredient.quantity)) {
        return false; // Missing required ingredient quantity
      }
    }
    return true; // All ingredients present
  }

  /**
   * Attempts to craft an item. Checks resources, consumes them, and adds the output.
   * @param {string} outputItemId - The ID of the item to craft.
   * @returns {boolean} True if crafting was successful, false otherwise.
   */
  craftItem(outputItemId) {
    const recipe = getRecipeData(outputItemId);
    const inventory =
      this.gameInstance?.playerController?.player?.userData?.inventory;
    const uiManager = this.gameInstance?.uiManager;

    if (!recipe || !inventory || !uiManager) {
      console.error(
        "Crafting failed: Missing recipe, inventory, or UI manager."
      );
      return false;
    }

    // 1. Check if craftable (enough resources)
    if (!this.canCraft(outputItemId)) {
      uiManager.log("Cannot craft: Missing ingredients.");
      console.warn(`Crafting failed for ${outputItemId}: Missing ingredients.`);
      return false;
    }

    // 2. Check if inventory has space/weight for the output
    const outputItemData = getItemData(recipe.outputItemId);
    const outputWeight = (outputItemData?.weight || 0) * recipe.outputQuantity;
    if (inventory.currentWeight + outputWeight > inventory.maxWeight) {
      uiManager.log("Cannot craft: Not enough inventory weight capacity.");
      console.warn(`Crafting failed for ${outputItemId}: Overweight.`);
      return false;
    }
    // Simple slot check: Assume 1 new stack needed
    if (
      inventory.items.length >= inventory.size &&
      !inventory.hasItem(recipe.outputItemId)
    ) {
      // Check if full AND player doesn't already have a stack of the output item
      uiManager.log("Cannot craft: Inventory slots full.");
      console.warn(
        `Crafting failed for ${outputItemId}: Inventory slots full.`
      );
      return false;
    }

    // 3. Consume Ingredients
    let consumedSuccessfully = true;
    for (const ingredient of recipe.ingredients) {
      const removedInfo = inventory.removeItem(
        ingredient.itemId,
        ingredient.quantity
      );
      if (!removedInfo || removedInfo.quantity < ingredient.quantity) {
        // This check *shouldn't* fail if canCraft passed, but good safety measure
        consumedSuccessfully = false;
        console.error(
          `Crafting error: Failed to consume enough ${ingredient.itemId} for ${outputItemId}.`
        );
        // TODO: Potentially roll back previously consumed items? (More complex)
        break;
      }
    }

    if (!consumedSuccessfully) {
      uiManager.log("Crafting Error: Failed to consume ingredients.");
      return false; // Stop if consumption failed
    }

    // 4. Add Output Item
    const addedCount = inventory.addItem(
      recipe.outputItemId,
      recipe.outputQuantity
    );

    if (addedCount >= recipe.outputQuantity) {
      const outputName = outputItemData?.name || recipe.outputItemId;
      uiManager.log(`Crafted ${recipe.outputQuantity}x ${outputName}!`);
      console.log(
        `Successfully crafted ${recipe.outputQuantity}x ${recipe.outputItemId}.`
      );
      // Inventory UI update is handled by the 'inventoryChanged' event emitted by addItem/removeItem
      return true;
    } else {
      uiManager.log(
        `Crafting Error: Could not add ${recipe.outputItemId} to inventory.`
      );
      console.error(
        `Crafting error: Failed to add output ${recipe.outputItemId}. Added: ${addedCount}/${recipe.outputQuantity}`
      );
      // TODO: Potentially roll back consumed items?
      return false;
    }
  }
}

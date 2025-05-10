// src/game/components/LootComponent.js

/**
 * Defines the item(s) that can be looted or collected from an entity.
 */
export class LootComponent {
  /** @type {string} The unique ID of the item. */
  itemId;
  /** @type {number} The quantity of the item. */
  quantity;

  /**
   * @param {string} itemId - The item ID (e.g., 'wood_log', 'stone').
   * @param {number} [quantity=1] - The number of items represented.
   */
  constructor(itemId = "unknown_item", quantity = 1) {
    this.itemId = itemId;
    this.quantity = quantity;
  }
}

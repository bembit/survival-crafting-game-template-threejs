// src/game/components/ResourceNodeComponent.js

/**
 * Defines properties for a resource node (e.g., tree, ore vein).
 */
export class ResourceNodeComponent {
  /** @type {string} ID of the resource item dropped (e.g., 'wood_log', 'iron_ore'). */
  resourceId;
  /** @type {number} Amount of resource remaining or number of drops. */
  quantity;
  /** @type {number} Time in seconds for the node to respawn after depletion (-1 for no respawn). */
  respawnTime;
  /** @type {number} Internal timer for respawning. */
  _respawnTimer = 0;

  /**
   * @param {string} resourceId - The item ID dropped.
   * @param {number} [quantity=3] - How many times the node can be harvested.
   * @param {number} [respawnTime=-1] - Respawn time in seconds (-1 = no respawn).
   */
  constructor(resourceId = "unknown_resource", quantity = 3, respawnTime = -1) {
    this.resourceId = resourceId;
    this.quantity = quantity;
    this.respawnTime = respawnTime;
  }

  /** Deplete one unit of the resource. Returns true if successful, false if empty. */
  deplete() {
    if (this.quantity > 0) {
      this.quantity--;
      console.log(`Resource depleted, ${this.quantity} remaining.`);
      if (this.quantity <= 0 && this.respawnTime > 0) {
        this._respawnTimer = this.respawnTime;
      }
      return true;
    }
    return false;
  }

  /** Update respawn timer. Returns true if respawned. */
  updateRespawn(delta) {
    if (this.quantity <= 0 && this._respawnTimer > 0) {
      this._respawnTimer -= delta;
      if (this._respawnTimer <= 0) {
        // TODO: Reset quantity to initial value
        // this.quantity = initialQuantity; // Need to store initial quantity
        console.log(`Resource node ${this.resourceId} respawned!`);
        return true;
      }
    }
    return false;
  }
}

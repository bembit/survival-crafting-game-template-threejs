// src/game/components/InteractableComponent.js

/**
 * Marks an entity as interactable and defines its interaction type.
 */
export class InteractableComponent {
  /** @type {string} Type of interaction (e.g., 'cuttable', 'mineable', 'npc', 'lootable'). */
  type;
  /** @type {string | null} Optional: Tool required for interaction (e.g., 'axe', 'pickaxe'). */
  requiresTool;
  /** @type {boolean} Is the interaction currently possible? */
  enabled = true;

  /**
   * @param {string} type - The interaction type.
   * @param {string | null} [requiresTool=null] - Tool required.
   */
  constructor(type = "static", requiresTool = null) {
    this.type = type;
    this.requiresTool = requiresTool;
  }
}

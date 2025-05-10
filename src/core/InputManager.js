// src/core/InputManager.js
// import * as THREE from "three"; // Needed only if actions involve vectors later

/**
 * Defines abstract game actions. Using constants prevents typos.
 */
export const Actions = {
  // Movement
  MOVE_FORWARD: "moveForward", // Held action
  MOVE_BACKWARD: "moveBackward", // Held action
  STRAFE_LEFT: "strafeLeft", // Held action - Strafe is not implemented yet
  STRAFE_RIGHT: "strafeRight", // Held action - Strafe is not implemented yet
  SPRINT: "sprint", // Held action
  JUMP: "jump", // Triggered action
  // Combat
  ATTACK: "attack", // Triggered action
  INTERACT: "interact", // Triggered action
  // Camera
  CAMERA_ROTATE_X: "cameraRotateX", // Analog value
  CAMERA_ROTATE_Y: "cameraRotateY", // Analog value
  CAMERA_ZOOM: "cameraZoom", // Analog value
  CAMERA_LOCK: "cameraLock", // Held action (e.g., right mouse for pointer lock/rotate)
  // UI Actions
  TOGGLE_INVENTORY: "toggleInventory", // Triggered action
  TOGGLE_CHARACTER_SHEET: "toggleCharacterSheet", // Triggered action
  // Ability Actions
  USE_ABILITY_1: "useAbility1",
  USE_ABILITY_2: "useAbility2",
  USE_ABILITY_3: "useAbility3",
  USE_ABILITY_4: "useAbility4",
};

/**
 * Manages raw browser input events and maps them to abstract game Actions.
 * Stores the current state and values of these actions.
 * Other systems query this manager for action states instead of raw key/mouse states.
 */
export class InputManager {
  /** @type {HTMLCanvasElement} Reference to the canvas element. */
  canvas;
  /** @type {Map<string, string>} Maps KeyboardEvent.code to Action name. */
  _keyToActionMap = new Map();
  /** @type {Map<number, string>} Maps MouseEvent.button code to Action name. */
  _mouseButtonToActionMap = new Map();
  /** @type {Map<string, boolean | string>} Stores the state of actions (true/false for held, 'triggered'/'idle' for triggers). */
  _actionStates = new Map();
  /** @type {Map<string, number>} Stores accumulated values for analog-like actions (mouse/wheel delta). */
  _actionValues = new Map();
  /** @type {boolean} Flag indicating if the mouse cursor is currently over the canvas element. */
  isCanvasActive = false; // Keep this for knowing when to capture mouse maybe

  constructor(canvas) {
    this.canvas = canvas;
    this._configureDefaultKeybindings();
    this._initializeActionStates();
    this._bindEvents();
    console.log("InputManager initialized with Action Mapping.");
  }

  /** Sets up the default keyboard and mouse bindings */
  _configureDefaultKeybindings() {
    // Movement Keys
    this._keyToActionMap.set("KeyW", Actions.MOVE_FORWARD);
    this._keyToActionMap.set("KeyS", Actions.MOVE_BACKWARD);
    this._keyToActionMap.set("KeyA", Actions.STRAFE_LEFT);
    this._keyToActionMap.set("KeyD", Actions.STRAFE_RIGHT);
    this._keyToActionMap.set("ShiftLeft", Actions.SPRINT);
    this._keyToActionMap.set("ShiftRight", Actions.SPRINT); // Map both shifts
    this._keyToActionMap.set("Space", Actions.JUMP);

    this._keyToActionMap.set("KeyE", Actions.INTERACT);

    this._keyToActionMap.set("KeyI", Actions.TOGGLE_INVENTORY);
    this._keyToActionMap.set("KeyC", Actions.TOGGLE_CHARACTER_SHEET);

    // Ability Keybinds
    this._keyToActionMap.set("Digit1", Actions.USE_ABILITY_1); // Number row 1
    this._keyToActionMap.set("Digit2", Actions.USE_ABILITY_2); // Number row 2
    this._keyToActionMap.set("Digit3", Actions.USE_ABILITY_3); // Number row 3
    this._keyToActionMap.set("Digit4", Actions.USE_ABILITY_4); // Number row 4

    // Mouse Buttons (Mapping button code to action)
    this._mouseButtonToActionMap.set(0, Actions.ATTACK); // Left mouse button triggers Attack on mousedown
    this._mouseButtonToActionMap.set(2, Actions.CAMERA_LOCK); // Right mouse button activates camera lock/rotate mode

    // Mouse Movement & Wheel are handled directly in listeners
  }

  /** Initializes the state map for all known actions */
  _initializeActionStates() {
    // Initialize all actions defined in the Actions enum/object
    this._actionStates.set(Actions.TOGGLE_INVENTORY, false); // Triggered action
    this._actionStates.set(Actions.TOGGLE_CHARACTER_SHEET, false); // Triggered action
    for (const actionName of Object.values(Actions)) {
      // Analog values start at 0
      if (actionName.includes("Rotate") || actionName.includes("Zoom")) {
        this._actionValues.set(actionName, 0);
      }

      // Treat JUMP, INTERACT, TOGGLE_INVENTORY, AND ABILITIES as triggers
      else if (
        [
          Actions.JUMP,
          Actions.INTERACT,
          Actions.ATTACK,
          Actions.TOGGLE_INVENTORY,
          Actions.TOGGLE_CHARACTER_SHEET,
          Actions.USE_ABILITY_1,
          Actions.USE_ABILITY_2,
          Actions.USE_ABILITY_3,
          Actions.USE_ABILITY_4,
        ].includes(actionName)
      ) {
        this._actionStates.set(actionName, false);
      }
      // Treat others as held (e.g., move actions)
      else {
        this._actionStates.set(actionName, false);
      }
    }
  }

  /** Binds DOM event listeners */
  _bindEvents() {
    // --- Keyboard ---
    document.addEventListener("keydown", (event) => {
      const action = this._keyToActionMap.get(event.code);
      if (action) {
        // Mark TOGGLE_INVENTORY and ABILITIES as triggered ON KEYDOWN
        if (
          action === Actions.JUMP ||
          action === Actions.INTERACT ||
          action === Actions.TOGGLE_INVENTORY ||
          action === Actions.TOGGLE_CHARACTER_SHEET ||
          action === Actions.USE_ABILITY_1 ||
          action === Actions.USE_ABILITY_2 ||
          action === Actions.USE_ABILITY_3 ||
          action === Actions.USE_ABILITY_4
        ) {
          this._actionStates.set(action, true);
          // Prevent default for number keys if they might type in an input field later
          if (event.code.startsWith("Digit")) {
            event.preventDefault();
          }
        } else if (action !== Actions.JUMP) {
          // Keep existing logic for others
          this._actionStates.set(action, true);
        }
        // other preventDefaults..?
      }
    });

    document.addEventListener("keyup", (event) => {
      const action = this._keyToActionMap.get(event.code);
      if (action) {
        // For held actions (not trigger actions)
        if (
          ![
            // Actions.JUMP,
            // Actions.INTERACT,
            // Actions.TOGGLE_INVENTORY,
            // Actions.TOGGLE_CHARACTER_SHEET,
            Actions.USE_ABILITY_1,
            Actions.USE_ABILITY_2,
            Actions.USE_ABILITY_3,
            Actions.USE_ABILITY_4,
          ].includes(action)
        ) {
          this._actionStates.set(action, false);
        }
        // Trigger Jump on keyup
        if (action === Actions.JUMP) {
          this._actionStates.set(action, true);
        }
      }
    });

    // --- Mouse Focus ---
    this.canvas.addEventListener("mouseover", () => {
      this.isCanvasActive = true;
    });
    this.canvas.addEventListener("mouseout", () => {
      this.isCanvasActive = false;
    });

    // --- Mouse Movement ---
    document.addEventListener("mousemove", (event) => {
      // Accumulate deltas only if camera lock action is active OR maybe if LMB held over canvas?
      // Let's tie rotation strictly to CAMERA_LOCK
      if (
        this.isActionActive(Actions.CAMERA_LOCK) &&
        document.pointerLockElement === document.body
      ) {
        this._actionValues.set(
          Actions.CAMERA_ROTATE_X,
          (this._actionValues.get(Actions.CAMERA_ROTATE_X) || 0) +
            event.movementX
        );
        this._actionValues.set(
          Actions.CAMERA_ROTATE_Y,
          (this._actionValues.get(Actions.CAMERA_ROTATE_Y) || 0) +
            event.movementY
        );
      }
    });

    // // --- Mouse Buttons ---
    // document.addEventListener("mousedown", (event) => {
    //   if (event.target === this.canvas) {
    //     const action = this._mouseButtonToActionMap.get(event.button);
    //     if (action) {
    //       // For held actions (like CAMERA_LOCK), set state to true
    //       if (action === Actions.CAMERA_LOCK) {
    //         this._actionStates.set(action, true);
    //         // Request pointer lock when CAMERA_LOCK action starts
    //         document.body
    //           .requestPointerLock()
    //           .catch((err) => console.warn("Pointer lock failed.", err));
    //       }
    //       // For triggered actions (like ATTACK), set state to true ON MOUSE DOWN
    //       if (action === Actions.ATTACK) {
    //         this._actionStates.set(action, true); // Mark as triggered
    //       }
    //     }
    //     if (event.button === 1) event.preventDefault(); // Prevent middle click scroll
    //   }
    // });

    // Inside _bindEvents method...
    document.addEventListener("mousedown", (event) => {
      // --- Debugging Logs ---
      // console.log(`--- Mousedown Event ---`);
      // console.log(`Button Pressed: ${event.button}`);
      // console.log(`Target is Canvas: ${event.target === this.canvas}`);
      // console.log(`Pointer Lock Active: ${!!document.pointerLockElement}`);

      // Process if the click is on the canvas OR if pointer lock is already active on the body
      if (
        event.target === this.canvas ||
        document.pointerLockElement === document.body
      ) {
        const action = this._mouseButtonToActionMap.get(event.button);
        // console.log(`Action Mapped: ${action || 'None'}`);

        if (action) {
          // console.log(`Processing Action: ${action}`);

          // Logic for CAMERA_LOCK (RMB) - Request lock ONLY if target was canvas
          if (action === Actions.CAMERA_LOCK && event.target === this.canvas) {
            // console.log("-> Handling CAMERA_LOCK");
            this._actionStates.set(action, true);
            document.body.requestPointerLock().catch(/* ... */);
          }
          // Logic for ATTACK (LMB) - Will now run even if pointer lock is active
          else if (action === Actions.ATTACK) {
            // console.log("-> Handling ATTACK: Setting state true");
            this._actionStates.set(action, true);
          }
          // Handle other potential mouse button actions if any
          else {
            // console.log(`-> Handling other action: ${action}`);
            this._actionStates.set(action, true);
          }
        }
        if (event.button === 1) event.preventDefault(); // Keep preventing middle click scroll
      } else {
        // console.log("Mousedown ignored (target not canvas AND pointer lock not active)");
      }
      // console.log(`--- End Mousedown Event ---`);
    });

    // --- IMPORTANT: Ensure mouseup listener DOES NOT require target === canvas ---
    document.addEventListener("mouseup", (event) => {
      // No target check needed here, release button state regardless of target
      const action = this._mouseButtonToActionMap.get(event.button);
      if (action) {
        // Specific logic for CAMERA_LOCK on RMB up
        if (action === Actions.CAMERA_LOCK) {
          this._actionStates.set(action, false);
          // Check if pointer lock is still active before trying to exit
          if (document.pointerLockElement === document.body) {
            document.exitPointerLock();
          }
        }
        // REVISIT.
        // Logic for ATTACK on LMB up (set false only if treated as held)
        else if (action === Actions.ATTACK) {
          // Assuming ATTACK is a held action now:
          this._actionStates.set(action, false);
        }
        // Handle other potential mouse button actions if any
        else {
          this._actionStates.set(action, false); // Default for held actions
        }
      }
    });

    // document.addEventListener("mouseup", (event) => {
    //   const action = this._mouseButtonToActionMap.get(event.button);
    //   if (action) {
    //     // For held actions (like CAMERA_LOCK), set state to false
    //     if (action === Actions.CAMERA_LOCK) {
    //       this._actionStates.set(action, false);
    //       // Exit pointer lock when CAMERA_LOCK action ends
    //       if (document.pointerLockElement === document.body) {
    //         document.exitPointerLock();
    //       }
    //     }
    //     // Triggered actions like ATTACK are typically handled on mousedown, nothing needed on mouseup
    //   }
    // });

    // --- Mouse Wheel ---
    document.addEventListener(
      "wheel",
      (event) => {
        // Only process wheel events if mouse is over canvas? Optional.
        // if (!this.isCanvasActive) return;
        event.preventDefault();
        const scrollAmount = event.deltaY;
        const normalizedDelta =
          Math.sign(scrollAmount) * Math.min(Math.abs(scrollAmount), 30);
        // Accumulate zoom value (positive = zoom out / scroll down, negative = zoom in / scroll up)
        this._actionValues.set(
          Actions.CAMERA_ZOOM,
          (this._actionValues.get(Actions.CAMERA_ZOOM) || 0) +
            normalizedDelta * -0.01
        ); // Apply scaling here or in CameraController
      },
      { passive: false }
    );

    // --- Context Menu ---
    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault()
    );

    // --- Pointer Lock Change ---
    document.addEventListener(
      "pointerlockchange",
      () => {
        if (document.pointerLockElement !== document.body) {
          // If lock is lost while CAMERA_LOCK was active, deactivate it
          if (this.isActionActive(Actions.CAMERA_LOCK)) {
            this._actionStates.set(Actions.CAMERA_LOCK, false);
            console.log("Pointer lock lost, CAMERA_LOCK action deactivated.");
          }
        }
      },
      false
    );
  }

  /**
   * Checks if a held action is currently active (e.g., key is down).
   * @param {string} actionName - The name of the action (from Actions enum).
   * @returns {boolean} True if the action is currently active.
   */
  isActionActive(actionName) {
    return !!this._actionStates.get(actionName); // Simple boolean check for held actions
  }

  /**
   * Checks if a triggered action occurred this frame.
   * If it did, consumes the trigger (sets state back to inactive) and returns true.
   * @param {string} actionName - The name of the action (e.g., Actions.JUMP, Actions.ATTACK).
   * @returns {boolean} True if the action was triggered this frame.
   */
  wasActionTriggered(actionName) {
    if (this._actionStates.get(actionName) === true) {
      // Check if marked as triggered
      this._actionStates.set(actionName, false); // Consume the trigger
      return true;
    }
    return false;
  }

  /**
   * Gets the accumulated value for an analog-like action (e.g., mouse movement, zoom).
   * Returns 0 if the action has no value.
   * @param {string} actionName - The name of the action.
   * @returns {number} The accumulated value for the frame.
   */
  getActionValue(actionName) {
    return this._actionValues.get(actionName) || 0;
  }

  /**
   * Resets the per-frame accumulated action values (mouse/zoom deltas).
   * Also resets 'triggered' states that might not have been consumed.
   * Should be called at the end of the game loop frame.
   */
  resetFrameState() {
    // Reset analog values
    this._actionValues.set(Actions.CAMERA_ROTATE_X, 0);
    this._actionValues.set(Actions.CAMERA_ROTATE_Y, 0);
    this._actionValues.set(Actions.CAMERA_ZOOM, 0);

    // Reset any triggered actions that weren't consumed (optional, wasActionTriggered handles consumption)
    // This prevents jump/attack flags staying true if not checked in a frame
    if (this._actionStates.get(Actions.JUMP) === true)
      this._actionStates.set(Actions.JUMP, false);
    if (this._actionStates.get(Actions.ATTACK) === true)
      this._actionStates.set(Actions.ATTACK, false);
    if (this._actionStates.get(Actions.INTERACT) === true)
      this._actionStates.set(Actions.INTERACT, false);
    if (this._actionStates.get(Actions.TOGGLE_INVENTORY) === true)
      this._actionStates.set(Actions.TOGGLE_INVENTORY, false);

    if (this._actionStates.get(Actions.TOGGLE_CHARACTER_SHEET) === true)
      this._actionStates.set(Actions.TOGGLE_CHARACTER_SHEET, false);

    // <<< Ability Resets >>>
    if (this._actionStates.get(Actions.USE_ABILITY_1) === true)
      this._actionStates.set(Actions.USE_ABILITY_1, false);
    if (this._actionStates.get(Actions.USE_ABILITY_2) === true)
      this._actionStates.set(Actions.USE_ABILITY_2, false);
    if (this._actionStates.get(Actions.USE_ABILITY_3) === true)
      this._actionStates.set(Actions.USE_ABILITY_3, false);
    if (this._actionStates.get(Actions.USE_ABILITY_4) === true)
      this._actionStates.set(Actions.USE_ABILITY_4, false);
  }
} // End InputManager Class

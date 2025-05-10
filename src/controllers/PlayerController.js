// src/game/controllers/PlayerController.js
import * as THREE from "three";
// Core / Config / Systems
import { Actions } from "../core/InputManager.js";
import eventBus from "../core/EventBus.js";
import { PLAYER_CONFIG } from "../config/PlayerConfig.js";
import { PlayerAnimationFSM } from "../animation/PlayerAnimationFSM.js";

/**
 * Manages the player character's state, determines movement/action intent based on input,
 * applies forces/velocities to the physics body, delegates animation control to an FSM,
 * and handles visual rotation.
 */
export class PlayerController {
  // --- References ---
  /** @type {THREE.Object3D} The player's visual representation. */
  player;
  /** @type {THREE.Camera} The main game camera. */
  camera;
  /** @type {InputManager} Reference to the input manager. */
  inputManager;
  /** @type {Ammo.btRigidBody | null} Reference to the physics body. */
  physicsBody = null;
  /** @type {PhysicsEngine | null} Reference to the physics engine. */
  physicsEngine = null;
  /** @type {InstancedManager | null} Reference to the instanced manager */
  instancedManager = null;
  /** @type {SceneManager | null} Reference to the scene manager */
  sceneManager = null;
  /** @type {UIManager | null} Reference to the UI Manager */
  uiManager = null;
  /** @type {PlayerAnimationFSM | null} Manages animation states */
  animationFSM = null; // Initialized in constructor
  /** @type {import('../systems/SoundManager.js').SoundManager | null} */ // Type hint
  soundManager = null;

  // --- Movement & Physics State ---
  walkSpeed;
  runSpeed;
  movementSpeed;
  jumpHeight;
  jumpImpulse = 0;
  /** @type {boolean} Local flag indicating if the controller thinks the player is jumping/falling. */
  isJumping = false;

  // --- Attack State ---
  /** @type {boolean} Is the player currently in an attack animation/cooldown? */
  isAttacking = false;
  /** @type {number} Attack cooldown timer */
  attackTimer = 0;
  /** @type {number} Attack cooldown duration */
  attackCooldown;

  // --- Debug ---
  /** Shared material for debug lines */
  _debugLineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00,
    depthTest: false,
    depthWrite: false,
  });

  // *** Reusable vector for zeroing angular velocity ***
  _zeroAngularVelocity = null;

  /**
   * Initializes the PlayerController.
   * @param {THREE.Object3D} player
   * @param {THREE.Camera} camera
   * @param {InputManager} inputManager
   * @param {object|null} modelAnimations - Animation data { mixer, actions }.
   * @param {Ammo.btRigidBody | null} physicsBody
   * @param {PhysicsEngine | null} physicsEngine
   * @param {InstancedManager | null} instancedManager
   * @param {SceneManager | null} sceneManager
   * @param {UIManager | null} uiManager
   */
  constructor(
    player,
    camera,
    inputManager,
    modelAnimations = null,
    physicsBody = null,
    physicsEngine = null,
    instancedManager = null,
    sceneManager = null,
    uiManager = null,
    // soundManager added for jump sound
    soundManager
  ) {
    // <<< --- Debug log --- >>>
    // console.log(
    //   "PlayerController CONSTRUCTOR called. Received 'player' argument:",
    //   player
    // );
    // if (!player) {
    //   console.error(
    //     "PlayerController received NULL or UNDEFINED player model!"
    //   );
    // }

    // Store References
    this.player = player;
    this.camera = camera;
    this.inputManager = inputManager;
    this.physicsBody = physicsBody;
    this.physicsEngine = physicsEngine;
    this.instancedManager = instancedManager;
    this.sceneManager = sceneManager;
    this.uiManager = uiManager;
    this.soundManager = soundManager; // remove from here later //

    if (!this.soundManager)
      console.warn("PlayerController: SoundManager not provided!"); //

    // Movement Properties
    this.walkSpeed = PLAYER_CONFIG.WALK_SPEED;
    this.runSpeed = PLAYER_CONFIG.RUN_SPEED;
    this.movementSpeed = this.walkSpeed;

    // State Flags
    this.isJumping = false; // Represents being in the air (jump or fall)

    // Jump Properties
    this.jumpHeight = PLAYER_CONFIG.JUMP_HEIGHT;
    this.jumpImpulse = 0; // Calculated below

    // Attack State
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = PLAYER_CONFIG.ATTACK_COOLDOWN || 0.5;

    // --- Create Animation FSM ---
    // It automatically plays the Idle animation on creation if found
    if (modelAnimations && modelAnimations.actions) {
      this.animationFSM = new PlayerAnimationFSM(modelAnimations.actions);
    } else {
      console.warn(
        "PlayerController: No modelAnimations provided, animation FSM not created."
      );
      this.animationFSM = null; // Ensure it's explicitly null
    }

    // --- Calculate Jump Impulse ---
    this.calculateJumpImpulse(); // Moved to helper method

    // --- *** Initialize zero vector (check Ammo loaded) *** ---
    if (typeof Ammo !== "undefined" && Ammo) {
      this._zeroAngularVelocity = new Ammo.btVector3(0, 0, 0);
    } else {
      console.error(
        "PlayerController: Ammo not loaded, cannot create zero vector!"
      );
    }

    // --- REMOVED OLD ANIMATION PROPERTIES / INIT ---
    // this.currentAnimation = null; // Handled by FSM
    // this.animNames = ANIM_NAMES; // FSM uses config directly if needed
    // this.hasFallAnimation = ... // FSM handles checks internally
    // this.hasLandAnimation = ... // FSM handles checks internally
    // Initial switchAnimation(IDLE) call removed (FSM constructor handles it)
  }

  /** Helper function to handle ability trigger checks */
  _handleAbilityInput() {
    const abilityComp = this.player?.userData?.abilityComponent;
    if (!abilityComp) return; // No component, nothing to do

    // Get known abilities in the order they should appear on the bar
    // This assumes the order in the Set/Map corresponds to slots 1, 2, 3...
    // For more robust mapping, AbilityComponent could store an explicit bar order.
    const knownAbilities = abilityComp.getKnownAbilitiesArray();

    const abilityActions = [
      Actions.USE_ABILITY_1,
      Actions.USE_ABILITY_2,
      Actions.USE_ABILITY_3,
      Actions.USE_ABILITY_4,
    ];

    abilityActions.forEach((action, index) => {
      if (this.inputManager.wasActionTriggered(action)) {
        const abilityId = knownAbilities[index]; // Get ability ID for this slot index
        if (abilityId) {
          this.tryUseAbility(abilityId);
        } else {
          this.uiManager?.log(`No ability bound to slot ${index + 1}`);
        }
      }
    });
  }

  /** Attempts to use an ability if it's ready */
  tryUseAbility(abilityId) {
    const abilityComp = this.player?.userData?.abilityComponent;
    if (!abilityComp) return;

    if (abilityComp.isReady(abilityId)) {
      // Ability is ready! Trigger cooldown and emit event.
      this.uiManager?.log(`Using ability: ${abilityId}`);
      abilityComp.triggerCooldown(abilityId);

      // Emit event for AbilitySystem/InteractionSystem to handle the effect
      eventBus.emit("useAbility", {
        caster: this.player, // The player object
        casterBody: this.physicsBody, // Player physics body
        abilityId: abilityId,
        // target: null // Targeting needs to be implemented later. If.
      });

      // Optional: Trigger a specific animation via FSM if we have animations later...
      // this.isUsingAbility = true; // Set a flag for animation FSM if needed
    } else {
      // Ability on cooldown or unknown
      this.uiManager?.log(`Ability ${abilityId} is not ready.`);
      // Optional: Play an error sound/feedback
    }
  }

  /** Helper to calculate jump impulse */
  calculateJumpImpulse() {
    if (this.physicsBody && this.physicsEngine) {
      const mass = 70; // TODO: Get actual mass
      const gravityY = PLAYER_CONFIG.GRAVITY;
      if (gravityY < 0) {
        const initialVelocity = Math.sqrt(-2 * gravityY * this.jumpHeight);
        this.jumpImpulse = initialVelocity * mass;
        this.uiManager?.log(`Jump impulse: ${this.jumpImpulse.toFixed(1)}`);
      } else {
        console.error("Gravity must be negative!");
      }
    } else {
      console.warn("Jump impulse not calculated.");
    }
    this.jumpImpulse = this.jumpImpulse || 0;
  }

  /** Calculates movement direction based on input actions */
  calculateMovementDirection() {
    const direction = new THREE.Vector3();
    if (this.inputManager.isActionActive(Actions.MOVE_FORWARD))
      direction.z += 1;
    if (this.inputManager.isActionActive(Actions.MOVE_BACKWARD))
      direction.z -= 1;
    if (this.inputManager.isActionActive(Actions.STRAFE_LEFT)) direction.x += 1;
    if (this.inputManager.isActionActive(Actions.STRAFE_RIGHT))
      direction.x -= 1;
    if (direction.lengthSq() === 0) return direction;
    const cameraForward = new THREE.Vector3();
    this.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(this.camera.up, cameraForward).normalize();
    const moveVector = new THREE.Vector3()
      .addScaledVector(cameraForward, direction.z)
      .addScaledVector(cameraRight, direction.x);
    return moveVector.normalize();
  }

  /**
   * Updates the player's state, applies physics forces/impulses, manages visual rotation,
   * and delegates animation updates to the FSM.
   * @param {number} delta - The time elapsed since the last frame in seconds.
   */
  update(delta) {
    // Guard clause includes FSM check now
    if (
      !this.physicsBody ||
      !this.physicsEngine ||
      !this.animationFSM ||
      !this.inputManager ||
      !this._zeroAngularVelocity
    ) {
      // console.warn("PlayerController update skipped: Missing required component references."); // Debug warning
      return;
    }

    // --- Update Attack Timers and Cooldown ---
    let attackReady = !this.isAttacking;

    if (this.attackTimer > 0) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackTimer = 0;
      }
    }

    // --- Read Input Actions & Physics State ---
    const isMoving =
      this.inputManager.isActionActive(Actions.MOVE_FORWARD) ||
      this.inputManager.isActionActive(Actions.MOVE_BACKWARD) ||
      this.inputManager.isActionActive(Actions.STRAFE_LEFT) ||
      this.inputManager.isActionActive(Actions.STRAFE_RIGHT);
    const isSprinting = this.inputManager.isActionActive(Actions.SPRINT);
    const onGround = this.physicsEngine.isBodyOnGround(this.physicsBody);
    const actualVelocity = this.physicsBody.getLinearVelocity(); // Read once
    const currentYVelocity = actualVelocity.y();

    // --- Handle Triggered Actions (Jump, Attack) ---
    let justJumped = false;
    let justAttacked = false; // Can be useful for FSM context

    // Attack Action -> Emit Event
    if (
      this.inputManager.wasActionTriggered(Actions.ATTACK) &&
      attackReady &&
      onGround
    ) {
      this.isAttacking = true; // Set state for FSM & cooldown
      this.attackTimer = this.attackCooldown;
      justAttacked = true;
      this.uiManager?.log("Player Attack Intent"); // L Debug og intent
      // this.soundManager?.playSound("player_attack_punch"); // <<< Annoying on every attack, unless you like hearing "he ho hu ha he he he" //
      // --- Emit Attack Event ---
      // Pass necessary info for the InteractionSystem to perform the attack check
      eventBus.emit("playerAttack", {
        attacker: this.player, // Reference to player object (visual)
        attackerBody: this.physicsBody, // Reference to player physics body
      });
      // --- End Emit Event ---
      // performAttackRaycast() is removed - InteractionSystem handles it
    }

    // --- Interact Action -> Emit Event ---
    if (
      this.inputManager.wasActionTriggered(Actions.INTERACT) &&
      onGround &&
      !this.isAttacking
    ) {
      // Check conditions
      this.uiManager?.log("Player Interact Intent!");
      console.log("Player Interact Intent!");
      eventBus.emit("playerInteract", { interactor: this.player });
    }
    // --- End Interact Action ---

    // Jump Action
    if (
      this.inputManager.wasActionTriggered(Actions.JUMP) &&
      onGround &&
      !this.isAttacking
    ) {
      if (this.jumpImpulse > 0) {
        const impulseVec = this.physicsEngine.tempVec3;
        impulseVec.setValue(0, this.jumpImpulse, 0);
        this.physicsBody.applyCentralImpulse(impulseVec);
        this.physicsBody.activate(true);
        this.isJumping = true; // Set state flag for FSM
        justJumped = true;
        this.soundManager?.playSound("player_jump"); // <<< Play Jump Sound - Leaving this in for reference.
        // Animation now handled by FSM based on isJumping/justJumped flags
      }
    }
    // --- Handle Input Actions <<< Call the helper function ---
    this._handleAbilityInput();

    // --- Get Current Stats ---
    const statsComp = this.player?.userData?.stats; // Use 'stats' - statsComp renamed to stats on userdata for clarity

    // --- Determine CURRENT Movement Speed ---
    let currentMovementSpeed;
    if (statsComp) {
      currentMovementSpeed = isSprinting
        ? statsComp.currentRunSpeed // Get buffed run speed
        : statsComp.currentSpeed; // Get buffed walk speed
      // console.log(
      //   `Using Stats Speed: ${currentMovementSpeed.toFixed(
      //     2
      //   )} (Sprint: ${isSprinting})`
      // );
    } else {
      // Fallback if no stats component
      currentMovementSpeed = isSprinting
        ? PLAYER_CONFIG.RUN_SPEED
        : PLAYER_CONFIG.WALK_SPEED;
      console.log(
        `Using Fallback Speed: ${currentMovementSpeed.toFixed(
          2
        )} (Sprint: ${isSprinting})`
      );
    }
    // Store it if needed elsewhere, but primarily use the local variable 'currentMovementSpeed' now
    // this.movementSpeed = currentMovementSpeed; // Optional: Update controller property if needed elsewhere

    // Handle Jump Action
    // --- Apply/Manage Linear Velocity ---
    if (onGround && !justJumped && !this.isAttacking) {
      const currentAmmoVelocity = this.physicsBody.getLinearVelocity();
      const physicsTempVec = this.physicsEngine.tempVec3;

      // --- REMOVED INCORRECT OVERWRITE kept as reference ---
      // this.movementSpeed = isSprinting ? this.runSpeed : this.walkSpeed;

      const moveDirection = this.calculateMovementDirection();
      // --- Use the 'currentMovementSpeed' calculated earlier
      const desiredVelocity =
        moveDirection.multiplyScalar(currentMovementSpeed);
      // --- Use the 'currentMovementSpeed' calculated earlier

      physicsTempVec.setValue(
        desiredVelocity.x,
        currentAmmoVelocity.y(),
        desiredVelocity.z
      );
      this.physicsBody.setLinearVelocity(physicsTempVec); // Apply potentially buffed velocity
      this.physicsBody.activate(true); // Ensure body is active
    } else if (this.isAttacking && onGround) {
      // Stop horizontal movement while attacking on ground
      const currentAmmoVelocityY = this.physicsBody.getLinearVelocity().y();
      const physicsTempVec = this.physicsEngine.tempVec3;
      physicsTempVec.setValue(0, currentAmmoVelocityY, 0);
      this.physicsBody.setLinearVelocity(physicsTempVec);
    }
    // If airborne or just jumped, physics preserves momentum (no setLinearVelocity call)
    // --- Update State Flags (for FSM context) ---
    let justLanded = false;
    // Check for landing: We were in the jumping state, physics now says we are onGround,
    // and we didn't just start the jump this frame. Vertical velocity should be near zero or negative.
    if (this.isJumping && onGround && !justJumped) {
      if (currentYVelocity <= 0.1) {
        this.isJumping = false;
        justLanded = true;
      }
    }
    // Check if falling: Physics says not on ground and Y velocity is negative
    const isFalling = !onGround && currentYVelocity < -0.1;
    // Enter jump/fall state if walking off edge
    if (isFalling && !this.isJumping) {
      this.isJumping = true;
    }

    // --- Visual Rotation ---
    // Rotate visual model based on input/state, only when grounded & movable
    if (isMoving && onGround && !justJumped && !this.isAttacking) {
      // Calculate desired horizontal velocity for rotation direction
      const rotMoveDir = this.calculateMovementDirection();
      const rotSpeed = isSprinting ? this.runSpeed : this.walkSpeed;
      const rotDesiredVel = rotMoveDir.multiplyScalar(rotSpeed);
      if (rotDesiredVel.lengthSq() > PLAYER_CONFIG.MOVEMENT_INPUT_THRESHOLD) {
        const lookDirection = new THREE.Vector3(
          rotDesiredVel.x,
          0,
          rotDesiredVel.z
        ).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(
          PLAYER_CONFIG.MODEL_FORWARD_DIRECTION,
          lookDirection
        );
        this.player.quaternion.slerp(
          targetQuaternion,
          PLAYER_CONFIG.ROTATION_SPEED
        );
      }
    }

    // --- Animation Update via FSM ---
    // Gather current context/state for the FSM
    const animationContext = {
      onGround: onGround,
      isMoving: isMoving,
      isSprinting: isSprinting,
      isJumping: this.isJumping, // Controller's combined jump/fall state flag
      isFalling: isFalling, // Specific falling check result
      justLanded: justLanded,
      isAttacking: this.isAttacking,
      justJumped: justJumped,
      justAttacked: justAttacked, // <<< Pass attack trigger flag if needed by FSM
    };
    // Update the FSM with the current context
    this.animationFSM.update(animationContext); // <<< DELEGATE TO FSM

    // --- *** Zero out Angular Velocity *** ---
    // This should be done AFTER applying linear velocity and BEFORE the physics step
    // to prevent friction/contacts from causing spin this frame.
    this.physicsBody.setAngularVelocity(this._zeroAngularVelocity);
    // --- Debug Log ---
    // console.log(`PlayerCtrl State - Vel:[${actualVelocity.x().toFixed(2)}, ...], OnGround:${onGround}, JustJumped:${justJumped}, IsJumping:${this.isJumping}, IsAttacking:${this.isAttacking}`);
  } // End update()
} // End PlayerController class

// src/systems/AISystem.js
import { AI_STATES } from "../game/components/AIComponent.js";
// import { PLAYER_CONFIG } from "../config/PlayerConfig.js";
import * as THREE from "three";

export class AISystem {
  activeEnemies = new Map();
  playerRef = null;
  physicsEngine = null;
  uiManager = null; // Assuming UIManager might be needed for feedback later

  _enemyPos = new THREE.Vector3();
  _playerPos = new THREE.Vector3();
  _moveDirection = new THREE.Vector3();
  // Add forward vector if needed for raycast inside applyEnemyAttackDamage
  _forward = new THREE.Vector3();
  _rayStart = new THREE.Vector3();
  _rayEnd = new THREE.Vector3();

  // checking passing back the physics to the enemy
  _threeQuaternion = new THREE.Quaternion();
  _ammoQuaternion = null; // Initialize in constructor after Ammo load check

  _wanderOrigin = new THREE.Vector3(); // Reusable vector for wander origin

  constructor(physicsEngine, uiManager = null) {
    // Made uiManager optional
    this.physicsEngine = physicsEngine;
    this.uiManager = uiManager; // Store UIManager reference

    this._wanderOrigin = new THREE.Vector3(); // Initialize

    if (typeof Ammo !== "undefined" && Ammo) {
      // It's generally safer to create Ammo objects after Ammo() promise resolves,
      // but placing it here might be okay if AISystem is created after Ammo init.
      // Consider moving initialization to an async init method or checking before use.
      try {
        this._ammoQuaternion = new Ammo.btQuaternion(0, 0, 0, 1);
      } catch (e) {
        console.error(
          "Failed to create Ammo.btQuaternion in AISystem constructor:",
          e
        );
        // Handle error appropriately, maybe set a flag?
      }
    } else {
      console.error("AISystem Constructor: Ammo not loaded!");
    }
    console.log("AISystem initialized.");
  }

  setPlayerReference(player) {
    // this.playerRef = player;
    // console.log("AISystem: Player reference set.");
    // console.log(
    //   "AISystem.setPlayerReference CALLED. Received player object:",
    //   player
    // );
    // if (!player) {
    //   console.error("AISystem received NULL or UNDEFINED player reference!");
    // }
    this.playerRef = player;
    console.log("AISystem: Player reference set.");
  }

  registerEnemy(instanceId, model, physicsBody) {
    // Check necessary components
    if (
      !model.userData.aiComponent ||
      !model.userData.healthComponent ||
      !model.userData.statsComponent ||
      !model.userData.enemyConfig ||
      !model.userData.animationFSM
    ) {
      console.error(
        `AISystem: Enemy ${instanceId} missing required component/config! Cannot register.`
      );
      return;
    }
    this.activeEnemies.set(instanceId, {
      model: model,
      physicsBody: physicsBody,
      aiComponent: model.userData.aiComponent,
      animationFSM: model.userData.animationFSM,
      statsComponent: model.userData.statsComponent,
      enemyConfig: model.userData.enemyConfig,
      healthComponent: model.userData.healthComponent,
    });
    console.log(
      `AISystem: Registered enemy ${instanceId}. Total: ${this.activeEnemies.size}`
    );
  }

  unregisterEnemy(instanceId) {
    this.activeEnemies.delete(instanceId);
    console.log(
      `AISystem: Unregistered enemy ${instanceId}. Total: ${this.activeEnemies.size}`
    );
  }

  // Helper function to pick a wander target
  _pickWanderTarget(aiComponent, enemyModel) {
    const wanderRadius = aiComponent.wanderRadius;
    const maxAttempts = 10; // Prevent infinite loops if no valid point found
    enemyModel.getWorldPosition(this._wanderOrigin); // Use current model position as origin

    for (let i = 0; i < maxAttempts; i++) {
      const randomAngle = Math.random() * Math.PI * 2;
      const randomRadius = Math.random() * wanderRadius; // Distance from origin

      const targetX =
        this._wanderOrigin.x + Math.cos(randomAngle) * randomRadius;
      const targetZ =
        this._wanderOrigin.z + Math.sin(randomAngle) * randomRadius;

      // Check terrain height at the potential target location
      const targetY = this.physicsEngine.getHeightAt(targetX, targetZ);

      if (targetY !== null) {
        // Found a valid spot on the ground
        aiComponent.wanderTargetPosition = new THREE.Vector3(
          targetX,
          targetY,
          targetZ
        );
        return; // Exit after finding a valid target
      }
    }

    // If loop finishes without finding a valid point
    console.warn(
      `AISystem: Could not find valid wander target for enemy after ${maxAttempts} attempts.`
    );
    aiComponent.wanderTargetPosition = null; // Ensure target is cleared
  }

  /** Main AI update loop, called by Game.js */
  update(delta) {
    // Add a check if the Ammo object failed to initialize
    if (
      !this.playerRef ||
      this.activeEnemies.size === 0 ||
      !this._ammoQuaternion
    ) {
      if (!this._ammoQuaternion)
        console.warn("AISystem update skipped: Ammo quaternion not ready.");
      return;
    }
    // Add a check if playerRef is valid and there are enemies to track
    if (!this.playerRef || this.activeEnemies.size === 0) {
      return;
    }

    this.playerRef.getWorldPosition(this._playerPos);

    for (const [instanceId, enemy] of this.activeEnemies.entries()) {
      const {
        model,
        physicsBody: body,
        aiComponent: ai,
        animationFSM: fsm,
        statsComponent: stats,
        enemyConfig: config,
        healthComponent: health,
      } = enemy;

      if (!ai || !body || !model || !stats || !config || !fsm || !health) {
        console.warn(
          `Skipping AI update for ${instanceId}: Missing components/config.`
        );
        continue;
      }

      // --- DEATH CHECK ---
      if (health.isDead()) {
        // If state isn't DEAD yet, set it and stop physics
        if (ai.currentState !== AI_STATES.DEAD) {
          console.log(
            `%c[${instanceId}] AISystem detected health <= 0. Setting state to DEAD.`,
            "color: red; font-weight: bold;"
          );
          ai.setState(AI_STATES.DEAD);

          // Stop physics movement immediately
          if (body && !body.isStaticObject() && this.physicsEngine?.tempVec3) {
            const physicsTempVec = this.physicsEngine.tempVec3;
            physicsTempVec.setValue(0, 0, 0);
            body.setLinearVelocity(physicsTempVec);
            body.setAngularVelocity(physicsTempVec); // Stop rotation too
            body.activate(true); // Ensure changes apply
          }
        }
        // Update FSM to ensure it reflects the DEAD state
        fsm?.update({
          aiState: AI_STATES.DEAD,
          isMoving: false,
          triggerAttack: false,
        });
        // Skip all other AI logic for this dead enemy
        continue;
      }

      // --- Perception & Distance ---
      const currentState = ai.currentState;
      model.getWorldPosition(this._enemyPos);
      const distanceToPlayerSq = this._enemyPos.distanceToSquared(
        this._playerPos
      );
      const perceptionRangeSq =
        (stats.perceptionRange || 10.0) * (stats.perceptionRange || 10.0);
      const attackDistanceSq =
        (config.ai.attackDistance || 1.8) * (config.ai.attackDistance || 1.8);

      let nextState = currentState;
      let targetEntity = ai.targetEntity;
      ai.triggerAttack = false; // Reset trigger

      // --- State Machine Logic ---

      // 1. Check if player is detected (highest priority, unless already attacking)
      if (
        currentState !== AI_STATES.ATTACKING && // Don't interrupt attack immediately
        distanceToPlayerSq < perceptionRangeSq &&
        currentState !== AI_STATES.DEAD
      ) {
        // Player detected or still perceived (and not dead)
        if (currentState !== AI_STATES.CHASING) {
          // ... (Log transition to CHASING) ...
          nextState = AI_STATES.CHASING;
          ai.actionTimer = 0; // Ensure cooldown is ready
          // ... (reset wander state) ...
        } else {
          nextState = AI_STATES.CHASING; // Remain chasing
        }
        targetEntity = this.playerRef;

        // Check if ALSO in attack range AND cooldown ready to transition CHASING -> ATTACKING
        if (distanceToPlayerSq < attackDistanceSq && ai.actionTimer <= 0) {
          // ... (Log transition CHASING -> ATTACKING) ...
          nextState = AI_STATES.ATTACKING;
          ai.triggerAttack = true; // Signal FSM
          ai.actionTimer = stats.attackCooldown || 2.0; // Start cooldown timer
          ai.damageAppliedThisAttack = false; // Reset damage flag
          ai.attackDamageTimer = null; // Reset damage timer
        }

        // 2. Logic for ATTACKING state
      } else if (currentState === AI_STATES.ATTACKING) {
        targetEntity = this.playerRef; // Keep targeting

        // Check if target moved completely out of PERCEPTION range first
        if (distanceToPlayerSq >= perceptionRangeSq * 1.2) {
          // Hysteresis
          console.log(
            `%c[${instanceId}] State: ATTACKING -> IDLE (Player lost completely)`,
            "color: red;"
          );
          nextState = AI_STATES.IDLE;
          targetEntity = null;
          ai.actionTimer = 0; // Reset cooldown
          ai.damageAppliedThisAttack = false; // Reset flags
          ai.attackDamageTimer = null;
        } else {
          // Player is still perceived. Continue attack cycle.
          // --- NO LONGER checking if player moved just outside attack range ---
          // --- Let the timer run down ---

          // Continue Cooldown and Damage Application Logic
          if (ai.actionTimer > 0) {
            ai.actionTimer -= delta;

            // Damage Application Timer Logic (with final range check)
            if (!ai.damageAppliedThisAttack) {
              const damageApplyDelay = 0.5;
              if (ai.attackDamageTimer === null)
                ai.attackDamageTimer = damageApplyDelay;
              ai.attackDamageTimer -= delta;
              if (ai.attackDamageTimer <= 0) {
                const finalDamageCheckSq = this._enemyPos.distanceToSquared(
                  this._playerPos
                );
                if (finalDamageCheckSq < attackDistanceSq) {
                  this.applyEnemyAttackDamage(enemy);
                } else {
                  console.log(
                    `[${instanceId}] Attack damage skipped: Target moved out of range just before hit.`
                  );
                }
                ai.damageAppliedThisAttack = true;
                ai.attackDamageTimer = null;
              }
            }
          } // End if (ai.actionTimer > 0)

          // Cooldown Finished Check
          if (ai.actionTimer <= 0) {
            console.log(
              `%c[${instanceId}] State: ATTACKING -> Cooldown Finished. Re-evaluating...`,
              "color: green;"
            );
            // Attack cycle complete, decide next state based on perception range
            if (distanceToPlayerSq < perceptionRangeSq) {
              console.log(` -> Transitioning back to CHASING`);
              nextState = AI_STATES.CHASING;
            } else {
              console.log(
                ` -> Transitioning back to IDLE (Player lost after attack)`
              );
              nextState = AI_STATES.IDLE;
              targetEntity = null;
            }
            // Reset flags for the *next* potential attack
            ai.damageAppliedThisAttack = false;
            ai.attackDamageTimer = null;
            // Action timer remains 0, CHASING state will handle transition
          } else {
            // Cooldown still running, REMAIN IN ATTACKING state
            nextState = AI_STATES.ATTACKING;
          }
        } // End else (player still perceived)
      } else if (currentState !== AI_STATES.DEAD) {
        // --- Logic for IDLE or WANDERING when player is NOT detected ---
        // (Keep your existing IDLE and WANDERING logic here)
        switch (currentState) {
          case AI_STATES.IDLE:
            ai.actionTimer -= delta;
            if (ai.actionTimer <= 0) {
              nextState = AI_STATES.WANDERING;
            } else {
              nextState = AI_STATES.IDLE;
            }
            targetEntity = null;
            break;

          case AI_STATES.WANDERING:
            ai.wanderTimer -= delta;
            if (!ai.wanderTargetPosition || ai.wanderTimer <= 0) {
              this._pickWanderTarget(ai, model);
              if (ai.wanderTargetPosition) {
                ai.wanderTimer =
                  Math.random() *
                    (ai.maxWanderDuration - ai.minWanderDuration) +
                  ai.minWanderDuration;
              } else {
                nextState = AI_STATES.IDLE;
              }
            }
            if (ai.wanderTargetPosition) {
              const distToWanderTargetSq = this._enemyPos.distanceToSquared(
                ai.wanderTargetPosition
              );
              const reachThresholdSq = 0.5 * 0.5;
              if (distToWanderTargetSq < reachThresholdSq) {
                nextState = AI_STATES.IDLE;
                ai.wanderTargetPosition = null;
                ai.wanderTimer = 0;
              } else {
                nextState = AI_STATES.WANDERING;
              }
            } else if (nextState !== AI_STATES.IDLE) {
              nextState = AI_STATES.WANDERING;
            }
            targetEntity = null;
            break;

          default: // Includes CHASING case where player was lost this frame
            nextState = AI_STATES.IDLE;
            targetEntity = null;
            break;
        }
      }
      // End else (player not detected or dead)

      // --- Set final state and target ---
      ai.targetEntity = targetEntity;
      ai.setState(nextState); // AIComponent handles internal timer resets based on state change

      // --- Rotation / Facing Logic ---
      let lookTargetPos = null;
      if (ai.currentState === AI_STATES.CHASING && ai.targetEntity) {
        lookTargetPos = this._playerPos;
      } else if (
        ai.currentState === AI_STATES.WANDERING &&
        ai.wanderTargetPosition
      ) {
        lookTargetPos = ai.wanderTargetPosition;
      } else if (ai.currentState === AI_STATES.ATTACKING && ai.targetEntity) {
        lookTargetPos = this._playerPos; // Keep looking while attacking
      }

      if (lookTargetPos) {
        // Orient visual model
        model.lookAt(lookTargetPos.x, model.position.y, lookTargetPos.z);

        // Synchronize Physics Body Rotation (keep existing logic)
        model.getWorldQuaternion(this._threeQuaternion);
        this._ammoQuaternion.setValue(
          this._threeQuaternion.x,
          this._threeQuaternion.y,
          this._threeQuaternion.z,
          this._threeQuaternion.w
        );

        const transform = body.getWorldTransform();
        transform.setRotation(this._ammoQuaternion);
        body.setWorldTransform(transform);
        const motionState = body.getMotionState();
        if (motionState) {
          motionState.setWorldTransform(transform);
        }
        body.activate(true);
      }

      // --- Movement Execution ---
      const physicsTempVec = this.physicsEngine.tempVec3;
      let desiredVelocityX = 0;
      let desiredVelocityZ = 0;
      let isMoving = false;
      let moveSpeed = stats.speed || 3.0;

      if (ai.currentState === AI_STATES.CHASING && ai.targetEntity) {
        this._moveDirection
          .subVectors(this._playerPos, this._enemyPos)
          .normalize();
        moveSpeed = stats.currentRunSpeed || stats.baseRunSpeed || 5.0;
        desiredVelocityX = this._moveDirection.x * moveSpeed;
        desiredVelocityZ = this._moveDirection.z * moveSpeed;
        isMoving = true;
      } else if (
        ai.currentState === AI_STATES.WANDERING &&
        ai.wanderTargetPosition
      ) {
        this._moveDirection
          .subVectors(ai.wanderTargetPosition, this._enemyPos)
          .normalize();
        moveSpeed = stats.speed || 3.0;
        desiredVelocityX = this._moveDirection.x * moveSpeed;
        desiredVelocityZ = this._moveDirection.z * moveSpeed;
        isMoving = true;
      } else if (
        ai.currentState === AI_STATES.IDLE ||
        ai.currentState === AI_STATES.ATTACKING
      ) {
        // Stop horizontal movement if IDLE or ATTACKING
        desiredVelocityX = 0;
        desiredVelocityZ = 0;
        isMoving = false;
      }

      // Apply velocity
      const currentVelocity = body.getLinearVelocity();
      physicsTempVec.setValue(
        desiredVelocityX,
        currentVelocity.y(),
        desiredVelocityZ
      );
      body.setLinearVelocity(physicsTempVec);
      if (isMoving || ai.triggerAttack) {
        body.activate(true);
      }

      // --- Update Animation FSM ---
      const animationContext = {
        aiState: ai.currentState,
        isMoving: isMoving,
        triggerAttack: ai.triggerAttack, // Pass trigger flag
      };
      fsm?.update(animationContext);
    } // End loop through enemies
  } // End update()

  /** Helper function to perform the damage check and application for an enemy attack */
  applyEnemyAttackDamage(enemy) {
    const {
      model: enemyModel,
      physicsBody: enemyBody,
      statsComponent: enemyStats,
      aiComponent: ai,
      enemyConfig: config,
    } = enemy;
    const playerBody = this.playerRef?.userData?.physicsBody;
    const playerHealthComp = this.playerRef?.userData?.health;

    if (
      !enemyModel ||
      !enemyBody ||
      !enemyStats ||
      !ai?.targetEntity ||
      !config ||
      !playerBody ||
      !playerHealthComp
    ) {
      console.warn(
        "applyEnemyAttackDamage: Missing required components/references for attack check."
      );
      return;
    }

    // --- Calculate _rayStart using head position logic
    const bodyHalfHeight =
      enemyBody.userData?.bodyHalfHeight || config.physicsConfig?.hy || 0.5;
    const bodyHalfDepth = config.physicsConfig?.hz || 0.5;
    const headHeightFactor = 0.8;
    const headForwardFactor = 0.6;
    enemyModel.getWorldDirection(this._forward);
    const transform = enemyBody.getWorldTransform();
    const bodyCenter = transform.getOrigin();
    this._rayStart.set(bodyCenter.x(), bodyCenter.y(), bodyCenter.z());
    this._rayStart.y += bodyHalfHeight * headHeightFactor;
    this._rayStart.addScaledVector(
      this._forward,
      bodyHalfDepth * headForwardFactor
    );

    // --- Calculate Ray End ---
    const attackCheckRange =
      enemyStats.currentAttackRange || config.ai.attackDistance || 1.8;
    this._rayEnd
      .copy(this._rayStart)
      .addScaledVector(this._forward, attackCheckRange);

    // Update raycast call and result handling >>>
    console.log(
      `[${config.name}] Raycast: From (${this._rayStart.x.toFixed(
        1
      )}, ${this._rayStart.y.toFixed(1)}, ${this._rayStart.z.toFixed(
        1
      )}) To (${this._rayEnd.x.toFixed(1)}, ${this._rayEnd.y.toFixed(
        1
      )}, ${this._rayEnd.z.toFixed(1)})`
    );
    const hitResult = this.physicsEngine.raycast(
      this._rayStart,
      this._rayEnd,
      enemyBody
    );
    const hitBody = hitResult?.body; // Get body from result

    // --- Process Hit ---
    if (hitBody === playerBody) {
      // Check the extracted body
      const damage = enemyStats.currentDamage || 5;
      console.log(
        `%c[${config.name}] Melee Hit connect! Dealing ${damage} damage to player.`,
        "color: red; font-weight: bold;"
      );
      this.uiManager?.log(
        `Initial ${damage} damage from ${config.name}!`,
        "red"
      );
      playerHealthComp.takeDamage(damage);
    } else {
      const hitTargetName =
        hitBody?.userData?.nodeName ||
        hitBody?.userData?.threeObject?.name ||
        "something else"; // Use hitBody
      console.log(
        `%c[${config.name}] Melee attack damage check missed player. Hit: ${hitTargetName}`,
        "color: red; font-weight: bold;"
      );
    }

    // IMPORTANT: Clean up the Ammo vectors from the raycast result
    if (hitResult) {
      Ammo.destroy(hitResult.point);
      Ammo.destroy(hitResult.normal);
    }
  } // End applyEnemyAttackDamage

  // ... rest of AISystem ...
} // End AISystem class

// src/controllers/CameraController.js
// Camera controller for player movement.
import * as THREE from "three";

import { CAMERA_CONFIG } from "../config/CameraConfig.js";
import { Actions } from "../core/InputManager.js";

export class CameraController {
  constructor(camera, inputManager) {
    /** @type {THREE.PerspectiveCamera} */
    this.camera = camera;
    /** @type {InputManager} */
    this.inputManager = inputManager;
    /** @type {THREE.Object3D | null} */
    this.player = null;

    // --- Use constants from config ---
    this.cameraTargetOffset = new THREE.Vector3(
      0,
      CAMERA_CONFIG.TARGET_OFFSET_Y,
      0
    );
    this.targetRotationAngle = CAMERA_CONFIG.INITIAL_ROTATION;
    this.currentRotationAngle = CAMERA_CONFIG.INITIAL_ROTATION;
    this.targetZoomDistance = CAMERA_CONFIG.INITIAL_ZOOM;
    this.currentZoomDistance = CAMERA_CONFIG.INITIAL_ZOOM;
    this.targetPitchOffset = CAMERA_CONFIG.INITIAL_Y_OFFSET;
    this.currentPitchOffset = CAMERA_CONFIG.INITIAL_Y_OFFSET;
    this.rotationSmoothFactor = CAMERA_CONFIG.ROTATION_SMOOTH_FACTOR;
    this.zoomSmoothFactor = CAMERA_CONFIG.ZOOM_SMOOTH_FACTOR;
    this.pitchSmoothFactor = CAMERA_CONFIG.PITCH_SMOOTH_FACTOR;
  }

  setPlayer(player) {
    this.player = player;
  }

  update(delta = 0.016) {
    // Ensure we have the necessary references
    if (!this.player || !this.inputManager || !this.camera) {
      // console.warn("CameraController missing player, inputManager, or camera reference.");
      return;
    }
    // Ensure player position is valid before proceeding
    if (
      isNaN(this.player.position.x) ||
      isNaN(this.player.position.y) ||
      isNaN(this.player.position.z)
    ) {
      console.error(
        "CameraController: Player position contains NaN!",
        this.player.position
      );
      return; // Avoid calculations with NaN
    }

    // --- Get Action States/Values ---
    const rotateX = this.inputManager.getActionValue(Actions.CAMERA_ROTATE_X);
    const rotateY = this.inputManager.getActionValue(Actions.CAMERA_ROTATE_Y);
    const zoom = this.inputManager.getActionValue(Actions.CAMERA_ZOOM);
    const isCameraLockActive = this.inputManager.isActionActive(
      Actions.CAMERA_LOCK
    );

    // --- Debug: Log Input Values ---
    // console.log(`Cam Update - Inputs: dX=${rotateX.toFixed(4)}, dY=${rotateY.toFixed(4)}, dZ=${zoom.toFixed(4)}, Lock=${isCameraLockActive}, Delta=${delta.toFixed(4)}`);

    // --- Update Target Values based on Actions ---
    if (isCameraLockActive && document.pointerLockElement === document.body) {
      this.targetRotationAngle -= rotateX * CAMERA_CONFIG.SENSITIVITY_X;
      // Horizontal pinch positive for reverse pitch.
      this.targetPitchOffset += rotateY * CAMERA_CONFIG.SENSITIVITY_Y * 2;
      // --- Optional: Turn off clamping for now. ---
      // this.targetPitchOffset = THREE.MathUtils.clamp(
      //     this.targetPitchOffset, CAMERA_CONFIG.PITCH_LIMIT_MIN_Y, CAMERA_CONFIG.PITCH_LIMIT_MAX_Y
      // );
    }
    if (zoom !== 0) {
      const zoomFactor = 1.0 - zoom * CAMERA_CONFIG.ZOOM_SENSITIVITY;
      this.targetZoomDistance *= zoomFactor;
      this.targetZoomDistance = Math.max(
        CAMERA_CONFIG.ZOOM_MIN,
        Math.min(CAMERA_CONFIG.ZOOM_MAX, this.targetZoomDistance)
      );
      // --- Optional: Proportional pitch adjustment (ensure not causing issues) ---
      this.targetPitchOffset *= zoomFactor;
      this.targetPitchOffset = THREE.MathUtils.clamp(
        this.targetPitchOffset,
        CAMERA_CONFIG.PITCH_LIMIT_MIN_Y,
        CAMERA_CONFIG.PITCH_LIMIT_MAX_Y
      );
    }

    // --- Smoothly Interpolate Current Values ---
    // Check for invalid delta before interpolation
    if (delta <= 0) {
      console.warn(
        "CameraController: Invalid delta time, skipping interpolation.",
        delta
      );
    } else {
      // Ensure smoothing factors are valid numbers
      const rotSmooth = CAMERA_CONFIG.ROTATION_SMOOTH_FACTOR || 15.0;
      const zoomSmooth = CAMERA_CONFIG.ZOOM_SMOOTH_FACTOR || 10.0;
      const pitchSmooth = CAMERA_CONFIG.PITCH_SMOOTH_FACTOR || 10.0;

      this.currentRotationAngle = THREE.MathUtils.lerp(
        this.currentRotationAngle,
        this.targetRotationAngle,
        1.0 - Math.exp(-rotSmooth * delta)
      );
      this.currentZoomDistance = THREE.MathUtils.lerp(
        this.currentZoomDistance,
        this.targetZoomDistance,
        1.0 - Math.exp(-zoomSmooth * delta)
      );
      this.currentPitchOffset = THREE.MathUtils.lerp(
        this.currentPitchOffset,
        this.targetPitchOffset,
        1.0 - Math.exp(-pitchSmooth * delta)
      );
    }

    // --- Log Internal State AFTER interpolation ---
    // console.log(`Cam Update - State: Angle=${this.currentRotationAngle.toFixed(2)}, Zoom=${this.currentZoomDistance.toFixed(2)}, PitchY=${this.currentPitchOffset.toFixed(2)}, PlayerY=${this.player.position.y.toFixed(2)}`);

    // --- Calculate Final Camera Position ---
    const finalOffset = new THREE.Vector3();
    finalOffset.x = Math.sin(this.currentRotationAngle);
    finalOffset.z = Math.cos(this.currentRotationAngle);
    // Prevent division by zero if angle calculation fails, though normalize should handle it
    if (finalOffset.lengthSq() > 0.0001) {
      finalOffset.normalize();
    } else {
      finalOffset.set(0, 0, 1); // Default offset if calculation failed
    }
    finalOffset.multiplyScalar(this.currentZoomDistance);

    // Calculate final position relative to player
    this.camera.position.copy(this.player.position).add(finalOffset);
    // Apply vertical offset (pitch)
    this.camera.position.y = this.player.position.y + this.currentPitchOffset;

    // --- Update LookAt ---
    const lookAtTarget = this.player.position
      .clone()
      .add(this.cameraTargetOffset);
    this.camera.lookAt(lookAtTarget);

    // --- Log Final Calculated Transform ---
    // Check for NaN values before logging/rendering
    if (isNaN(this.camera.position.x) || isNaN(lookAtTarget.x)) {
      console.error("!!! Camera position or target contains NaN !!!");
      console.error("Position:", this.camera.position);
      console.error("Target:", lookAtTarget);
      console.error("Internal State:", {
        angle: this.currentRotationAngle,
        zoom: this.currentZoomDistance,
        pitch: this.currentPitchOffset,
      });
      console.error("Player Pos:", this.player.position);
      // Potentially pause or reset camera state here
    } else {
      // Log final values if they are valid
      //  console.log(`Cam Update - Final: Pos:[${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}] Target:[${lookAtTarget.x.toFixed(1)}, ${lookAtTarget.y.toFixed(1)}, ${lookAtTarget.z.toFixed(1)}]`);
    }

    // InputManager reset is called in Game.js loop
  }
}

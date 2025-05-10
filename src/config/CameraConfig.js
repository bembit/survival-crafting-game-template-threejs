// src/config/CameraConfig.js
// Parameters for the third-person camera behavior.
export const CAMERA_CONFIG = {
  PITCH_LIMIT_MIN_Y: 2, // Minimum camera height relative to player pivot. Controls min pitch angle.
  PITCH_LIMIT_MAX_Y: 8, // Maximum camera height relative to player pivot. Controls max pitch angle.
  ZOOM_MIN: 2, // Minimum distance from player pivot.
  ZOOM_MAX: 15, // Maximum distance from player pivot.
  INITIAL_ZOOM: 3, // Starting distance from the player.
  INITIAL_Y_OFFSET: 3, // Starting height offset (defines initial pitch along with zoom).
  INITIAL_ROTATION: -3, // Initial horizontal rotation angle in radians (approx -86 degrees).
  SENSITIVITY_X: 0.003, // Multiplier for horizontal mouse movement affecting rotation.
  SENSITIVITY_Y: 0.003, // Multiplier for vertical mouse movement affecting pitch (Y offset).
  ZOOM_SENSITIVITY: 0.1, // Multiplier for mouse wheel scrolling affecting zoom distance.
  TARGET_OFFSET_Y: 1.0, // Vertical offset from the player's base position (pivot) where the camera should lookAt.
  ROTATION_SMOOTH_FACTOR: 25.0, // Camera smoothness related, higher is less smooth
  CAMERA_CONFIGZOOM_SMOOTH_FACTOR: 10.0, // Camera smoothness related
  PITCH_SMOOTH_FACTOR: 25.0, // Camera smoothness related
  // Camera is not clamped, uncomment it in CameraController.js line 72 ish : // Turn off clamping for now.
};

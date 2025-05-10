// src/config/SceneConfig.js
// Scene config settings
import { Vector3 } from "three";

export const SCENE_CONFIG = {
  CAMERA_FOV: 75,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  AMBIENT_LIGHT_COLOR: 0xffffff,
  // AMBIENT_LIGHT_INTENSITY: 1.0,
  AMBIENT_LIGHT_INTENSITY: 0.2,
  SUNLIGHT_COLOR: 0xffffff,
  SUNLIGHT_INTENSITY: 1.0,
  // Handled in DayNightSystem now.
  // SUNLIGHT_POSITION: new Vector3(10, 20, 10),
  SUNLIGHT_POSITION: new Vector3(100, 150, 125),
  SHADOW_MAP_SIZE: 8192,
  SHADOW_CAMERA_NEAR: 0.5,
  SHADOW_CAMERA_FAR: 500,
  SHADOW_CAMERA_BOUNDS: 350,
  // Handled in init() terrain in game.js
  // GROUND_SIZE: 64,
  // Handled by scene / env systems.
  // GROUND_COLOR: 0x555555,
  SKYBOX_COLOR: 0xabcdef,
};

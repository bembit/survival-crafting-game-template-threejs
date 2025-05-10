// src/config/MaterialConfig.js
// Shared config materials for tree, stone meshes and debug shapes
// Partially unused since adding Models.
import { MeshBasicMaterial, MeshStandardMaterial } from "three";

// Shared Material for Physics Debug Shapes
export const debugMaterial = new MeshBasicMaterial({
  color: 0xff0000,
  wireframe: true,
});

// --- Resource Materials ---
// Tree Materials (ensure these match InstancedManager)
export const treeTrunkMaterial = new MeshStandardMaterial({ color: 0x66402c }); // Brown
export const treeLeavesMaterial = new MeshStandardMaterial({ color: 0x3a7d44 }); // Darker Green

// Rock Materials (ensure these match InstancedManager or define here)
export const rockMaterial = new MeshStandardMaterial({
  color: 0x888888,
  flatShading: true,
}); // Grey, flat shaded
export const oreMaterial = new MeshStandardMaterial({
  color: 0x888890,
  flatShading: true,
  metalness: 0.5,
  roughness: 0.6,
}); // Ore material

// Material for Depleted/Placeholder visuals
export const depletedRockMaterial = new MeshStandardMaterial({
  color: 0x444444,
  flatShading: true,
}); // Dark grey
export const fallingLogMaterial = treeTrunkMaterial; // Falling log uses the trunk material

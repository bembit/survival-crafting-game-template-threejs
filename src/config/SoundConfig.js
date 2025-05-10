// src/config/SoundConfig.js
// Only using a few sounds for demo purposes.
// Needs some time to polish up and extend.

export const SOUND_CONFIG = {
  // Global Volume Settings (0.0 to 1.0)
  masterVolume: 0.5,
  sfxVolume: 0.3,
  bgmVolume: 0.3,
  ambientVolume: 0.6,
  // Sound Definitions
  sounds: {
    // --- SFX ---
    // Player Actions
    // walk_grass: {
    //   path: "./sounds/sfx/walk_grass_loop.wav",
    //   type: "sfx",
    //   loop: true,
    //   volume: 0.6,
    // }, // Looping walk sound
    player_jump: {
      path: "./sounds/sfx/female/attack1.wav",
      type: "sfx",
      volume: 0.5,
    },
    // player_walk: {
    //   path: "./sounds/sfx/snow/snow1.wav",
    //   type: "sfx",
    //   volume: 0.5,
    // },
    player_healed: {
      path: "./sounds/sfx/female/healed3.wav",
      type: "sfx",
      volume: 0.5,
    },
    player_attack_punch: {
      path: "./sounds/sfx/female/jump2.wav",
      type: "sfx",
      volume: 0.35,
    },
    // Interaction
    hit_wood: { path: "./sounds/sfx/hit_wood.wav", type: "sfx", volume: 0.2 },
    hit_iron: { path: "./sounds/sfx/hit_iron.wav", type: "sfx", volume: 0.2 },
    hit_rock: { path: "./sounds/sfx/hit_rock.wav", type: "sfx", volume: 0.2 },
    // hit_enemy: { path: "./sounds/sfx/hit_flesh.wav", type: "sfx", volume: 0.8 },
    // tree_fall: { path: "./sounds/sfx/tree_fall.wav", type: "sfx", volume: 1.0 }, // Could be positional later
    // Crafting/Inventory
    // craft_success: {
    //   path: "./sounds/sfx/craft_success.wav",
    //   type: "sfx",
    //   volume: 0.7,
    // },
    // item_pickup: {
    //   path: "./sounds/sfx/item_pickup.wav",
    //   type: "sfx",
    //   volume: 0.6,
    // },
    // item_place: {
    //   path: "./sounds/sfx/item_place.wav",
    //   type: "sfx",
    //   volume: 0.7,
    // },
    // // UI
    // ui_click_button: {
    //   path: "./sounds/sfx/ui_click.wav",
    //   type: "sfx",
    //   volume: 0.5,
    // },
    // ui_inventory_open: {
    //   path: "./sounds/sfx/inventory_open.wav",
    //   type: "sfx",
    //   volume: 0.7,
    // },
    // ui_inventory_close: {
    //   path: "./sounds/sfx/inventory_close.wav",
    //   type: "sfx",
    //   volume: 0.7,
    // },

    // --- Ambient --- (Often looping and positional)
    // ambient_campfire: {
    //   path: "./sounds/ambient/campfire_loop.wav",
    //   type: "ambient",
    //   loop: true,
    //   positional: true,
    //   refDistance: 1.5,
    //   rolloffFactor: 2.5,
    //   volume: 0.8,
    // },
    // ambient_forest_day: {
    //   path: "./sounds/ambient/forest_day_loop.wav",
    //   type: "ambient",
    //   loop: true,
    //   volume: 0.5,
    // },
    // ambient_forest_night: {
    //   path: "./sounds/ambient/forest_night_loop.wav",
    //   type: "ambient",
    //   loop: true,
    //   volume: 0.6,
    // },

    // --- Enemy --- (Often positional)
    // wolf_howl: {
    //   path: "./sounds/enemies/wolf_howl.wav",
    //   type: "enemy",
    //   positional: true,
    //   refDistance: 8,
    //   rolloffFactor: 1.5,
    //   volume: 0.9,
    // },
    // wolf_attack: {
    //   path: "./sounds/enemies/wolf_snap.wav",
    //   type: "enemy",
    //   positional: true,
    //   refDistance: 3,
    //   volume: 1.0,
    // },
    // wolf_hurt: {
    //   path: "./sounds/enemies/wolf_whimper.wav",
    //   type: "enemy",
    //   positional: true,
    //   refDistance: 5,
    //   volume: 1.0,
    // },
    // wolf_death: {
    //   path: "./sounds/enemies/wolf_death.wav",
    //   type: "enemy",
    //   positional: true,
    //   refDistance: 5,
    //   volume: 1.0,
    // },

    // --- BGM --- (Looping, non-positional)
    // bgm_main_theme: {
    //   path: "./music/1.mp3",
    //   type: "bgm",
    //   loop: true,
    //   volume: 0.7,
    // },
    bgm_explore_day: {
      path: "./music/4.mp3",
      type: "bgm",
      loop: true,
      volume: 0.8,
    },
    bgm_explore_night: {
      path: "./music/3.mp3",
      type: "bgm",
      loop: true,
      volume: 0.7,
    },
    // bgm_combat: {
    //   path: "./music/4.mp3",
    //   type: "bgm",
    //   loop: true,
    //   volume: 0.9,
    // },
  },
};

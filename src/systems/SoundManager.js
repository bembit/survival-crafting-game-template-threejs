// src/systems/SoundManager.js
import * as THREE from "three";
import { SOUND_CONFIG } from "../config/SoundConfig.js";

export class SoundManager {
  /** @type {THREE.AudioListener | null} */
  listener = null;
  /** @type {THREE.AudioLoader} */
  audioLoader = new THREE.AudioLoader();
  /** @type {Map<string, THREE.AudioBuffer>} */
  soundCache = new Map();
  /** @type {boolean} */
  isInitialized = false; // To prevent playing before context is ready
  /** @type {boolean} */
  isLoadingComplete = false;

  // Audio instances for global loops/categories
  /** @type {THREE.Audio | null} */
  bgmAudio = null;
  /** @type {THREE.Audio | null} */
  ambientAudio = null; // For non-positional ambient sounds

  // Keep track of active positional sounds to manage them
  /** @type {Map<string, THREE.PositionalAudio>} */
  activePositionalSounds = new Map(); // Key: unique id (e.g., `campfire_${obj.uuid}`), Value: PositionalAudio instance

  currentBgmId = null;
  gameInstance = null;

  // --- Mute State ---
  isMuted = false; // Track mute state
  originalMasterVolume = 1.0; // Store the configured volume

  constructor(camera) {
    if (!camera) {
      console.error("SoundManager: THREE.Camera instance is required!");
      return;
    }
    this.listener = new THREE.AudioListener();
    camera.add(this.listener); // Attach listener to the camera

    if (this.listener) {
      this.listener.setMasterVolume(SOUND_CONFIG.masterVolume ?? 1.0); // Apply initial master volume
      console.log(
        `[SoundManager] Initial listener master volume set to: ${
          SOUND_CONFIG.masterVolume ?? 1.0
        }`
      );
    }

    // --- Store original volume and set initial listener volume ---
    this.originalMasterVolume = SOUND_CONFIG.masterVolume ?? 1.0;
    if (this.listener) {
      //
      this.listener.setMasterVolume(this.originalMasterVolume); // Apply initial master volume
      console.log(
        `[SoundManager] Initial listener master volume set to: ${this.originalMasterVolume}`
      );
    }

    // Create global audio nodes (if needed)
    this.bgmAudio = new THREE.Audio(this.listener);
    this.ambientAudio = new THREE.Audio(this.listener);

    console.log("SoundManager initialized. Waiting for AudioContext resume...");

    // Attempt to resume context on first interaction (essential for browsers)
    const resumeContext = () => {
      if (this.isInitialized) {
        console.log(
          "[SoundManager resumeContext] Already initialized, removing listeners."
        );
        document.removeEventListener("click", resumeContext);
        document.removeEventListener("keydown", resumeContext);
        document.removeEventListener("touchstart", resumeContext);
        return;
      }
      if (this.listener?.context.state === "suspended") {
        console.log(
          "[SoundManager resumeContext] Attempting AudioContext resume..."
        );
        this.listener.context
          .resume()
          .then(() => {
            console.log(
              "[SoundManager resumeContext] SUCCESS: AudioContext resumed!"
            );
            this.isInitialized = true;
            console.log(
              `[SoundManager resumeContext] State after resume success: isInitialized=${this.isInitialized}, isLoadingComplete=${this.isLoadingComplete}`
            );
            if (this.isLoadingComplete) {
              console.log(
                "[SoundManager resumeContext] Loading was complete, calling startInitialSounds()."
              );
              this.startInitialSounds();
            } else {
              console.log(
                "[SoundManager resumeContext] Loading NOT complete yet."
              );
            }
          })
          .catch((e) => {
            console.error(
              "[SoundManager resumeContext] AudioContext resume FAILED:",
              e
            );
          });
      } else if (this.listener?.context.state === "running") {
        console.log(
          "[SoundManager resumeContext] AudioContext was already running on interaction."
        );
        this.isInitialized = true;
        console.log(
          `[SoundManager resumeContext] State for already running: isInitialized=${this.isInitialized}, isLoadingComplete=${this.isLoadingComplete}`
        );
        if (this.isLoadingComplete) {
          console.log(
            "[SoundManager resumeContext] Loading was complete, calling startInitialSounds()."
          );
          this.startInitialSounds();
        } else {
          console.log("[SoundManager resumeContext] Loading NOT complete yet.");
        }
      } else {
        console.warn(
          `[SoundManager resumeContext] Context in unexpected state: ${this.listener?.context.state}`
        );
      }
      // Remove listeners after first attempt
      document.removeEventListener("click", resumeContext); //
      document.removeEventListener("keydown", resumeContext); //
      document.removeEventListener("touchstart", resumeContext); //
      console.log(
        "[SoundManager resumeContext] Interaction listeners removed."
      );
    };
    document.addEventListener("click", resumeContext, { once: true });
    document.addEventListener("keydown", resumeContext, { once: true });
    document.addEventListener("touchstart", resumeContext, { once: true });
  }

  async loadSounds() {
    console.log("SoundManager: Starting sound loading...");
    this.isLoadingComplete = false;
    const soundsToLoad = Object.entries(SOUND_CONFIG.sounds);
    let loadedCount = 0;
    const totalCount = soundsToLoad.length;

    const loadPromises = soundsToLoad.map(([id, config]) => {
      return new Promise((resolve, reject) => {
        this.audioLoader.load(
          config.path,
          (buffer) => {
            // onLoad
            this.soundCache.set(id, buffer);
            loadedCount++;
            // console.log(`Loaded sound: ${id} (${loadedCount}/${totalCount})`);
            resolve({ id, status: "loaded" });
          },
          undefined, // onProgress (usually not needed for audio)
          (error) => {
            // onError
            console.error(
              `SoundManager: Failed to load sound "${id}" from ${config.path}`,
              error
            );
            resolve({ id, status: "error" }); // Resolve even on error to not break Promise.all
          }
        );
      });
    });

    await Promise.all(loadPromises);
    this.isLoadingComplete = true;
    console.log(
      `SoundManager: Loading finished. ${this.soundCache.size}/${totalCount} sounds loaded successfully.`
    );

    // If context already resumed, start initial sounds
    if (this.isInitialized) {
      this.startInitialSounds();
    }
  }

  // Called once context is ready and loading is done
  startInitialSounds() {
    console.log("SoundManager: Starting initial sounds (BGM/Ambient)...");
    // Start default background music and ambient sound
    this.startBGM("bgm_explore_day"); // Choose your default BGM
    this.startAmbientSound("ambient_forest_day"); // Choose default ambient
  }

  /** Plays a non-positional sound effect */
  playSound(soundId, volumeScale = 1.0) {
    // Primarily check the actual context state. Also check cache.
    if (
      this.listener?.context?.state !== "running" ||
      !this.soundCache.has(soundId)
    ) {
      console.warn(
        `[SoundManager.playSound] Cannot play '${soundId}'. Context State: ${
          this.listener?.context?.state
        }, Cached: ${this.soundCache.has(soundId)}`
      );
      // Optional: You could try resuming again here, but it might indicate a deeper issue.
      // if(this.listener?.context?.state === 'suspended') { this.listener.context.resume(); }
      return;
    }

    const buffer = this.soundCache.get(soundId);
    const config = SOUND_CONFIG.sounds[soundId];
    // Ensure defaults for volumes if not present in SOUND_CONFIG
    const configVolume = config?.volume ?? 1.0;
    const sfxVolume = SOUND_CONFIG.sfxVolume ?? 1.0;
    const masterVolume = SOUND_CONFIG.masterVolume ?? 1.0;
    const finalVolume = configVolume * sfxVolume * masterVolume * volumeScale;

    console.log(
      `[SoundManager.playSound] Attempting to play '${soundId}'. FinalVol: ${finalVolume.toFixed(
        3
      )}`
    );

    if (finalVolume <= 0) {
      console.warn(
        `[SoundManager.playSound] Skipping play for '${soundId}' due to zero volume.`
      );
      return;
    }

    const sound = new THREE.Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setLoop(config?.loop ?? false);
    sound.setVolume(finalVolume);
    sound.play();
    console.log(`[SoundManager.playSound] '${soundId}' .play() called.`);
  }

  /** Plays a sound attached to a 3D object */
  playPositionalSound(
    soundId,
    targetObject,
    uniqueId,
    loop = false,
    volumeScale = 1.0
  ) {
    // --- CHECK AT THE START ---
    if (this.listener?.context?.state !== "running") {
      console.warn(
        `[SoundManager.playPositionalSound] Cannot play '${soundId}': AudioContext not running (State: ${this.listener?.context?.state}).`
      );
      return null;
    }
    if (!this.soundCache.has(soundId) || !targetObject?.isObject3D) {
      console.warn(
        `[SoundManager.playPositionalSound] Cannot play '${soundId}': Sound not cached or invalid targetObject.`
      );
      return null;
    }

    const buffer = this.soundCache.get(soundId);
    // ... rest of the positional sound logic (calculate volume, get/create PositionalAudio, set properties, play) ...
    // Ensure volume calculation uses defaults from SOUND_CONFIG if needed
    const config = SOUND_CONFIG.sounds[soundId];
    const soundType = config?.type || "sfx";
    let categoryVolume = SOUND_CONFIG.sfxVolume ?? 1.0;
    if (soundType === "ambient")
      categoryVolume = SOUND_CONFIG.ambientVolume ?? 1.0;
    else if (soundType === "enemy")
      categoryVolume = SOUND_CONFIG.sfxVolume ?? 1.0; // Or enemy vol

    const volume =
      (config?.volume ?? 1.0) *
      categoryVolume *
      (SOUND_CONFIG.masterVolume ?? 1.0) *
      volumeScale;

    if (volume <= 0) {
      console.warn(
        `[SoundManager.playPositionalSound] Skipping play for '${soundId}' due to zero volume.`
      );
      return null; // Return null or the non-playing sound instance? Null is cleaner.
    }

    let sound = this.activePositionalSounds.get(uniqueId);
    // ... (rest of the logic: create/stop existing, set buffer, loop, volume, distance, play, onEnded) ...
    if (sound && sound.isPlaying && !loop) {
      sound.stop();
    }
    if (!sound) {
      /* ... create PositionalAudio, add to targetObject, add to map ... */
      sound = new THREE.PositionalAudio(this.listener);
      targetObject.add(sound);
      this.activePositionalSounds.set(uniqueId, sound);
    }
    sound.setBuffer(buffer);
    sound.setLoop(loop);
    sound.setVolume(volume);
    sound.setRefDistance(config?.refDistance ?? 1);
    sound.setRolloffFactor(config?.rolloffFactor ?? 1);
    sound.play();

    if (!loop) {
      sound.onEnded = () => {
        /* todo cleanup */
      };
    }
    return sound;
  }

  /** Stops a specific positional sound instance */
  stopPositionalSound(uniqueId) {
    if (this.activePositionalSounds.has(uniqueId)) {
      const sound = this.activePositionalSounds.get(uniqueId);
      if (sound.isPlaying) {
        sound.stop();
      }
      if (sound.parent) {
        sound.parent.remove(sound); // Detach
      }
      this.activePositionalSounds.delete(uniqueId); // Stop tracking
      sound.onEnded = null; // Clean up listener
    }
  }

  /** Starts or changes the background music */
  startBGM(bgmId, fadeDuration = 0.5) {
    //
    if (!this.isInitialized || !this.soundCache.has(bgmId) || !this.bgmAudio) {
      //
      console.warn(
        `Cannot start BGM '${bgmId}'. Initialized: ${
          this.isInitialized
        }, Cached: ${this.soundCache.has(bgmId)}`
      );
      return;
    }

    // --- Check if already playing this BGM ---
    if (this.currentBgmId === bgmId && this.bgmAudio.isPlaying) {
      // console.log(`BGM '${bgmId}' is already playing.`);
      return; // Don't restart the same track
    }

    const buffer = this.soundCache.get(bgmId);
    const config = SOUND_CONFIG.sounds[bgmId];
    const targetVolume =
      (config?.volume ?? 1.0) *
      (SOUND_CONFIG.bgmVolume ?? 1.0) *
      (SOUND_CONFIG.masterVolume ?? 1.0);

    console.log(
      `[SoundManager] Starting BGM: ${bgmId}, Volume: ${targetVolume.toFixed(
        3
      )}`
    );

    // Basic crossfade (stop previous, start new) - Improve later with tweening if needed
    if (this.bgmAudio.isPlaying) {
      console.log(`Stopping previous BGM: ${this.currentBgmId}`);
      this.bgmAudio.stop();
    }

    this.bgmAudio.setBuffer(buffer);
    this.bgmAudio.setLoop(config?.loop ?? true);
    this.bgmAudio.setVolume(targetVolume); // Set volume directly for now
    this.bgmAudio.play();
    this.currentBgmId = bgmId; // <<< Store the ID of the playing track
  }

  /** Starts or changes the global ambient sound */
  startAmbientSound(ambientId) {
    if (
      !this.isInitialized ||
      !this.soundCache.has(ambientId) ||
      !this.ambientAudio
    )
      return;
    const buffer = this.soundCache.get(ambientId);
    const config = SOUND_CONFIG.sounds[ambientId];
    const targetVolume =
      (config?.volume ?? 1.0) *
      SOUND_CONFIG.ambientVolume *
      SOUND_CONFIG.masterVolume;

    if (this.ambientAudio.isPlaying) {
      this.ambientAudio.stop();
    }
    this.ambientAudio.setBuffer(buffer);
    this.ambientAudio.setLoop(config?.loop ?? true);
    this.ambientAudio.setVolume(targetVolume);
    this.ambientAudio.play();
  }

  // Toggle Mute Method
  toggleMute() {
    if (!this.listener) return;

    this.isMuted = !this.isMuted;
    const targetVolume = this.isMuted ? 0 : this.originalMasterVolume;
    this.listener.setMasterVolume(targetVolume);
    console.log(
      `[SoundManager] Master volume ${
        this.isMuted ? "muted (0)" : `unmuted (${targetVolume})`
      }`
    );
    // Optional: Inform UI
    this.gameInstance?.uiManager?.log(
      `Sound ${this.isMuted ? "Muted" : "Unmuted"}`
    );
  }

  setMasterVolume(volume) {
    // Update the original volume and apply, respecting mute state
    const newVolume = THREE.MathUtils.clamp(volume, 0, 1); //
    this.originalMasterVolume = newVolume; // Store the new desired non-mute volume
    SOUND_CONFIG.masterVolume = newVolume; // Update config value if desired (might not persist)

    if (this.listener && !this.isMuted) {
      // Only apply if not muted
      this.listener.setMasterVolume(this.originalMasterVolume);
    }
    console.log(
      `[SoundManager] Master volume setting changed to: ${
        this.originalMasterVolume
      }. Currently ${this.isMuted ? "Muted" : "Active"}.`
    );
  }

  // Implement setSfxVolume, setBgmVolume etc. - these would need to iterate active sounds or use GainNodes

  // Method to be called when an object emitting positional sound is removed
  removeObjectSounds(targetObject) {
    if (!targetObject) return;
    const soundsToRemove = [];
    // Find sounds attached to this object (can be slow if many sounds)
    this.activePositionalSounds.forEach((sound, uniqueId) => {
      if (sound.parent === targetObject) {
        if (sound.isPlaying) sound.stop();
        // Don't remove from map here, just collect IDs
        soundsToRemove.push(uniqueId);
      }
    });
    // Remove collected sounds
    soundsToRemove.forEach((id) => this.activePositionalSounds.delete(id));
    // THREE.js should handle removing children when targetObject is removed from scene
  }

  destroy() {
    // Stop all sounds
    this.bgmAudio?.stop();
    this.ambientAudio?.stop();
    this.activePositionalSounds.forEach((sound) => {
      if (sound.isPlaying) sound.stop();
      if (sound.parent) sound.parent.remove(sound);
    });
    this.activePositionalSounds.clear();
    this.soundCache.clear();
    if (this.listener && this.listener.parent) {
      this.listener.parent.remove(this.listener); // Detach listener
    }
    this.isInitialized = false;
    this.isLoadingComplete = false;
    console.log("SoundManager destroyed.");
  }
}

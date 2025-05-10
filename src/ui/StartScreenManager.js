// src/ui/StartScreenManager.js

export class StartScreenManager {
  startScreenElement;
  startButton;
  detailSelect; // Using one selector for simplicity
  startGameCallback; // Function to call when starting the game

  constructor(startGameCallback) {
    this.startScreenElement = document.getElementById("start-screen");
    this.startButton = document.getElementById("start-game-button");
    this.detailSelect = document.getElementById("setting-detail"); // Get the main selector
    // Get other selectors if you added them...

    if (!this.startScreenElement || !this.startButton || !this.detailSelect) {
      console.error(
        "StartScreenManager: Could not find all required UI elements!"
      );
      return;
    }

    this.startGameCallback = startGameCallback;
    this._setupEventListeners();
    console.log("StartScreenManager initialized.");
  }

  _setupEventListeners() {
    this.startButton.addEventListener("click", this._onStartClick.bind(this));
    // Add listeners for tooltip visibility if needed
  }

  _getSettings() {
    // Return the selected value (e.g., "low", "medium", "high")
    return {
      detail: this.detailSelect.value,
      // Get values from other selectors if added
      // enemyActivation: document.getElementById('setting-enemy').value,
      // shadowQuality: document.getElementById('setting-shadows').value,
      // objectDensity: document.getElementById('setting-objects').value,
    };
  }

  _onStartClick() {
    const settings = this._getSettings();
    console.log("Start button clicked. Settings selected:", settings);
    if (this.startGameCallback) {
      this.startGameCallback(settings); // Pass settings to the game launch function
    }
    this.hide();
  }

  show() {
    if (this.startScreenElement) {
      this.startScreenElement.classList.remove("hidden");
      // Force display style if visibility alone isn't enough
      //  this.startScreenElement.style.display = 'flex';
    }
  }

  hide() {
    if (this.startScreenElement) {
      this.startScreenElement.classList.add("hidden");
      // Optional: Set display none after transition
      // setTimeout(() => {
      //     if(this.startScreenElement.classList.contains('hidden')) {
      //        this.startScreenElement.style.display = 'none';
      //     }
      // }, 500); // Match CSS transition duration
    }
  }
}

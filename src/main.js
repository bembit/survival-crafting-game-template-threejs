// src/main.js
import "./style.css";
import { Game } from "./Game.js";
import { StartScreenManager } from "./ui/StartScreenManager.js";

// Ensure the DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  let gameInstance = null;

  // Function to launch the game with the given settings
  function launchGame(settings) {
    console.log("Launching game with settings:", settings);
    if (gameInstance) {
      console.warn("Game instance already exists. Preventing relaunch.");
      return;
    }
    try {
      gameInstance = new Game(settings); // Pass settings to the Game constructor
      console.log("Game Initialized");
    } catch (error) {
      console.error("Failed to initialize game:", error);
      document.body.innerHTML = `<div style="color: red; padding: 20px;">Error initializing game: ${error.message}</div>`; // Init error display
    }
  }

  // Create and show the start screen
  const startScreenManager = new StartScreenManager(launchGame);
  // startScreenManager.show(); // Show the start screen initially (remove hidden class in CSS or call show)

  // If the start screen is initially visible via CSS, no need to call show().
  // If it's hidden by default, uncomment the line above.
});

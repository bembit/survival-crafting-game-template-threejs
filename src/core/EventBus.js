// src/core/EventBus.js
// EventBus singleton for global event handling
// on(), off(), emit() methods
// Usage: eventBus.on("eventName", callback);

class EventBus {
  constructor() {
    this.events = {};
    if (EventBus.instance) {
      return EventBus.instance;
    }
    EventBus.instance = this;
    console.log("EventBus initialized.");
  }
  on(eventName, callback) {
    if (typeof callback !== "function") {
      console.error(`Listener for "${eventName}" not a function.`);
      return () => {};
    }
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    return () => {
      this.off(eventName, callback);
    };
  }
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter(
      (cb) => cb !== callback
    );
  }
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    const listeners = [...this.events[eventName]];
    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (e) {
        console.error(`Error in listener for ${eventName}:`, e);
      }
    });
  }
}
const eventBus = new EventBus();
export default eventBus;

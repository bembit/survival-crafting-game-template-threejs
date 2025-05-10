// src/ui/TooltipHelper.js

/**
 * A reusable helper class to manage a single, custom tooltip element
 * that follows the mouse and displays content for hovered elements.
 */
export class TooltipHelper {
  tooltipElement;
  boundUpdatePosition; // Store bound reference for listener removal

  constructor() {
    // Create the tooltip element once
    this.tooltipElement = document.createElement("div");
    this.tooltipElement.id = "custom-tooltip"; // Assign an ID for styling
    this.tooltipElement.classList.add("custom-tooltip"); // Use class for styling
    document.body.appendChild(this.tooltipElement);

    // Bind the position update function to maintain 'this' context
    this.boundUpdatePosition = this._updatePosition.bind(this);

    console.log("TooltipHelper initialized.");
  }

  /**
   * Attaches tooltip functionality to a target DOM element.
   * @param {HTMLElement} element - The element to attach the tooltip listeners to.
   * @param {string | Function} contentProvider - Either a static string or a function that returns the tooltip content (string or HTML).
   */
  attach(element, contentProvider) {
    if (!element) return;

    const showTooltip = (event) => {
      const content =
        typeof contentProvider === "function"
          ? contentProvider() // Call function to get dynamic content
          : contentProvider; // Use static string

      if (!content || String(content).trim() === "") {
        this._hideTooltip(); // Don't show empty tooltips
        return;
      }

      this.tooltipElement.innerHTML = content; // Use innerHTML to allow basic formatting (like \n becoming <br>)
      this._updatePosition(event); // Initial position
      this.tooltipElement.style.display = "block";
      this.tooltipElement.style.opacity = "1"; // Fade in

      // Optional: Add mousemove listener for continuous tracking *while hovered*
      element.addEventListener("mousemove", this.boundUpdatePosition);
    };

    const hideTooltip = () => {
      this._hideTooltip();
      // Optional: Remove mousemove listener
      element.removeEventListener("mousemove", this.boundUpdatePosition);
    };

    // Store references for easy removal
    element._tooltipShowHandler = showTooltip;
    element._tooltipHideHandler = hideTooltip;

    element.addEventListener("mouseenter", showTooltip);
    element.addEventListener("mouseleave", hideTooltip);
    // Handle focus/blur for keyboard accessibility (optional)
    // element.addEventListener('focus', showTooltip);
    // element.addEventListener('blur', hideTooltip);
  }

  /**
   * Detaches tooltip functionality from an element. Important for cleanup.
   * @param {HTMLElement} element - The element to detach listeners from.
   */
  detach(element) {
    if (!element) return;

    if (element._tooltipShowHandler) {
      element.removeEventListener("mouseenter", element._tooltipShowHandler);
      // element.removeEventListener('focus', element._tooltipShowHandler);
      delete element._tooltipShowHandler; // Clean up property
    }
    if (element._tooltipHideHandler) {
      element.removeEventListener("mouseleave", element._tooltipHideHandler);
      // element.removeEventListener('blur', element._tooltipHideHandler);
      element.removeEventListener("mousemove", this.boundUpdatePosition); // Ensure mousemove is removed
      delete element._tooltipHideHandler; // Clean up property
    }
    // Ensure tooltip is hidden if detached while visible
    if (this.tooltipElement.style.display === "block") {
      this._hideTooltip();
    }
  }

  _hideTooltip() {
    this.tooltipElement.style.opacity = "0"; // Fade out
    // Use setTimeout to set display: none after the transition completes
    setTimeout(() => {
      // Check if it's still supposed to be hidden before setting display:none
      if (this.tooltipElement.style.opacity === "0") {
        this.tooltipElement.style.display = "none";
      }
    }, 200); // Match transition duration in CSS
  }

  /**
   * Updates the tooltip's position based on the mouse event.
   * Includes boundary checks to keep it on screen.
   * @param {MouseEvent} event
   */
  _updatePosition(event) {
    if (!this.tooltipElement || this.tooltipElement.style.display === "none")
      return;

    const xOffset = 15; // Offset from cursor horizontally
    const yOffset = 10; // Offset from cursor vertically
    let newX = event.clientX + xOffset;
    let newY = event.clientY + yOffset;

    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Boundary checks
    if (newX + tooltipRect.width > winWidth - 10) {
      // Keep 10px margin
      newX = event.clientX - tooltipRect.width - xOffset; // Flip to left
    }
    if (newY + tooltipRect.height > winHeight - 10) {
      // Keep 10px margin
      newY = event.clientY - tooltipRect.height - yOffset; // Flip above
    }
    if (newX < 10) newX = 10; // Keep 10px margin left
    if (newY < 10) newY = 10; // Keep 10px margin top

    this.tooltipElement.style.left = `${newX}px`;
    this.tooltipElement.style.top = `${newY}px`;
  }

  // Optional: Method to globally disable/enable tooltips
  setEnabled(enabled) {
    if (!enabled) {
      this._hideTooltip(); // Hide immediately if disabled
    }
    // You might store an internal flag and check it in showTooltip
  }
}

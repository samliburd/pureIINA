const { input, core, overlay } = iina;

import { AppState, VideoProcessor } from "./core";
import { setupMenus } from "./menus";
import { TimeUtils } from "./utils";

// Initialize Core Logic
const appState = new AppState();
const videoProcessor = new VideoProcessor(appState);

function setupEventListeners() {
  input.onMouseDown(input.MOUSE, () => {
    input.onMouseUp(input.MOUSE, ({ x, y }) => {
      videoProcessor.handleMouseClick(x, y);
    });
  });

  input.onKeyDown("c", () => {
    if (!appState.isWaitingForSecondClick) {
      appState.isWaitingForSecondClick = true;
      core.osd("Press 'c' again to cancel or click to set the second position.");
    } else {
      appState.isWaitingForSecondClick = false;
      core.osd("Waiting for second click cancelled.");
    }
  });

  input.onKeyDown("alt+c", () => {
    appState.reset();
    core.osd("Crop cancelled.");
  });

  input.onKeyDown("alt+k", async () => {
    await videoProcessor.copyCommandToClipboard();
  });
}

function startIntervals() {
  // Interval for sending data to the React Overlay
  setInterval(() => {
    overlay.postMessage("update", {
      time: TimeUtils.secondsToISO(core.status.position),
      videoWidth: core.status.videoWidth,
      videoHeight: core.status.videoHeight
    });
  }, 500);

  // Interval for internal video processor calculations
  setInterval(() => {
    videoProcessor.updateVideoVariables();
  }, 500);
}

function initialize() {
  // Load the UI
  overlay.loadFile("dist/ui/overlay/index.html");

  // Wire up the logic
  setupEventListeners();
  setupMenus(appState, videoProcessor);
  startIntervals();
}

// Start the application
initialize();

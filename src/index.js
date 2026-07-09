import {logger} from "./helpers";

const { input, core, overlay} = iina;

import { AppState, VideoProcessor } from "./core";
import { setupMenus } from "./menus";
import { TimeUtils } from "./utils";

// Initialize Core Logic
const appState = new AppState();
const videoProcessor = new VideoProcessor(appState);

function setupEventListeners() {
  input.onMouseDown(input.MOUSE, () => {
    input.onMouseUp(input.MOUSE, ({ x, y }) => {
      // 1. Let the processor sort out where this click belongs
      videoProcessor.handleMouseClick(x, y);

      // 2. Send the updated state to React
      sendClickState();
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
    // Sync React UI with the "c" keypress
    sendClickState();
  });

  input.onKeyDown("alt+c", () => {
    appState.reset();
    core.osd("Crop cancelled.");
    // Sync React UI after a reset
    sendClickState();
  });

  input.onKeyDown("alt+k", async () => {
    await videoProcessor.copyCommandToClipboard();
  });
}

function startIntervals() {
  setInterval(() => {
    overlay.postMessage("update", {
      time: TimeUtils.secondsToISO(core.status.position),
      videoFrame: core.window.frame,
      videoWidth: core.status.videoWidth,
      videoHeight: core.status.videoHeight,
      scale: appState.scale || 1 // <-- Added scale here
    });
  }, 500);

  setInterval(() => {
    videoProcessor.updateVideoVariables();
  }, 500);
}

function sendClickState() {
  // Use the scale calculated by videoProcessor (fallback to 1 if it hasn't calculated yet)
  const scale = appState.scale || 1;

  overlay.postMessage("click", {
    firstClick: appState.firstClickPos,
    secondClick: appState.secondClickPos,

    // Normalize the individual clicks using the backend's scale
    normFirstClick: {
      x: Math.round(appState.firstClickPos.x * scale),
      y: Math.round(appState.firstClickPos.y * scale)
    },
    normSecondClick: {
      x: Math.round(appState.secondClickPos.x * scale),
      y: Math.round(appState.secondClickPos.y * scale)
    },

    // Send the final crop rectangle already calculated by CoordinateUtils in core.js
    cropBox: appState.normalizedCoordinates,

    isWaiting: appState.isWaitingForSecondClick
  });
}

function initialize() {
  overlay.loadFile("dist/ui/overlay/index.html");

  setupEventListeners();
  setupMenus(appState, videoProcessor);
  startIntervals();
}

initialize();

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
      videoWidth: core.status.videoWidth,
      videoHeight: core.status.videoHeight
    });
  }, 500);

  setInterval(() => {
    videoProcessor.updateVideoVariables();
  }, 500);
}

// Renamed slightly for clarity, bundles both clicks and the waiting status
function sendClickState() {
  overlay.postMessage("click", {
    firstClick: appState.firstClickPos,
    secondClick: appState.secondClickPos,
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

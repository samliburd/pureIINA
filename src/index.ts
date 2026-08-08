const { input, core, overlay, event, utils, file, console } = iina;

import { AppState, VideoProcessor } from "./core";
import { setupMenus } from "./menus";
import { TimeUtils } from "./utils";

// Initialize Core Logic
const appState = new AppState();
const videoProcessor = new VideoProcessor(appState);

function setupEventListeners() {
    input.onMouseDown(input.MOUSE, () => {
        input.onMouseUp(input.MOUSE, ({ x, y }: { x: number; y: number }) => {
            // 1. Let the processor sort out where this click belongs
            videoProcessor.handleMouseClick(x, y);

            // 2. Send the updated state to React
            sendClickState();
            return true;
        });
        return true;
    });

    input.onKeyDown("c", () => {
        if (!appState.isWaitingForSecondClick) {
            appState.isWaitingForSecondClick = true;
            core.osd(
                "Press 'c' again to cancel or click to set the second position.",
            );
        } else {
            appState.isWaitingForSecondClick = false;
            core.osd("Waiting for second click cancelled.");
        }
        // Sync React UI with the "c" keypress
        sendClickState();
        return true;
    });

    input.onKeyDown("alt+c", () => {
        appState.reset();
        core.osd("Crop cancelled.");
        // Sync React UI after a reset
        sendClickState();
        return true;
    });

    input.onKeyDown("alt+k", () => {
        videoProcessor.copyCommandToClipboard();
        return true;
    });

    // const windowChange = event.on("iina.window-resized", () => {
    //     core.osd("Window resized")
    // })
}

function startIntervals() {
    setInterval(() => {
        overlay.postMessage("update", {
            time: TimeUtils.secondsToISO(core.status.position),
            videoFrame: core.window.frame,
            videoWidth: core.status.videoWidth,
            videoHeight: core.status.videoHeight,
            scale: appState.scale || 1, // <-- Added scale here
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
            y: Math.round(appState.firstClickPos.y * scale),
        },
        normSecondClick: {
            x: Math.round(appState.secondClickPos.x * scale),
            y: Math.round(appState.secondClickPos.y * scale),
        },

        // Send the final crop rectangle already calculated by CoordinateUtils in core.js
        cropBox: appState.normalizedCoordinates,

        isWaiting: appState.isWaitingForSecondClick,
    });
}

function exportAllKeybinds() {
    const allBindings = input.getAllKeyBindings();
    let exportText = "--- IINA Keybindings Export ---\n\n";

    // Loop through the dictionary and format each entry
    for (const [keyCode, binding] of Object.entries(allBindings)) {
        // Add each binding to our text string
        exportText += `Key Code: ${keyCode}\n`;
        exportText += `Action: ${binding.action}\n`;
        exportText += `Is IINA Command: ${binding.isIINACommand ? "Yes" : "No"}\n`;
        exportText += `---------------------------\n`;
    }

    // OPTION 1: Dump to the Plugin Console (Recommended)
    // You can view and copy this by opening IINA > Preferences > Plugins > Inspector
    console.log(exportText);

    // OPTION 2: Write to a file (if you have the 'file' module imported)
    // const { file } = iina;
    // const exportPath = file.appConfigDir + "/iina_keybindings.txt";
    // file.write(exportPath, exportText);
    // core.osd(`Exported to: ${exportPath}`);

    core.osd("Keybindings exported to console!");
}


function initialize() {
    overlay.loadFile("dist/ui/overlay/index.html");

    setupEventListeners();
    setupMenus(appState, videoProcessor);
    startIntervals();
    exportAllKeybinds();
}

initialize();

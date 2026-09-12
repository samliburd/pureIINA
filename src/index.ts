const { input, core, overlay, event, utils, file, console, sidebar } = iina;

import { AppState, VideoProcessor } from "./core";
import { setupMenus } from "./menus";
import { TimeUtils, UserPrompts, CoordinateUtils } from "./utils";
import { IPCUpdateMessage, IPCClickMessage, IPCTimeUpdateMessage, IPCSyncStateMessage, IPCSetFilenameMessage, IPCSetCropStringMessage } from "./types";

// Initialize Core Logic
const appState = new AppState();
const videoProcessor = new VideoProcessor(appState);

function setupEventListeners(): void {
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

function startIntervals(): void {
    setInterval(() => {
        const payload: IPCUpdateMessage = {
            time: TimeUtils.secondsToISO(core.status.position || 0),
            videoFrame: core.window.frame,
            videoWidth: core.status.videoWidth || 0,
            videoHeight: core.status.videoHeight || 0,
            scale: appState.scale || 1,
            showHud: appState.showHud
        };
        overlay.postMessage("update", payload);
        sidebar.postMessage("video-update", { 
            videoWidth: payload.videoWidth, 
            videoHeight: payload.videoHeight 
        });
    }, 500);

    setInterval(() => {
        videoProcessor.updateVideoVariables();
    }, 500);
}

function sendClickState(): void {
    // Use the scale calculated by videoProcessor (fallback to 1 if it hasn't calculated yet)
    const scale = appState.scale || 1;

    const payload: IPCClickMessage = {
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
    };

    overlay.postMessage("click", payload);

    if (appState.useCrop || appState.showHud) {
        overlay.show();
    } else {
        overlay.hide();
    }
}

function exportAllKeybinds(): void {
    const allBindings = input.getAllKeyBindings();

    // Initialize the CSV headers (added a leading newline to separate from the console timestamp)
    let exportText = "\nKey Code,Action,Is IINA Command\n";

    // Loop through the dictionary and format each entry as a CSV row
    for (const [keyCode, binding] of Object.entries(allBindings)) {
        const isIINA = binding.isIINACommand ? "Yes" : "No";

        // Standard CSV escaping: wrap fields in quotes and escape internal quotes by doubling them ("")
        const safeKeyCode = `"${keyCode.replace(/"/g, '""')}"`;
        const safeAction = `"${binding.action.replace(/"/g, '""')}"`;
        const safeIsIINA = `"${isIINA}"`;

        // Add the formatted row
        exportText += `${safeKeyCode},${safeAction},${safeIsIINA}\n`;
    }

    // Dump to the Plugin Console
    console.log(exportText);

    // OPTION 2: Write directly to a CSV file (if you have the 'file' module imported)
    // const { file } = iina;
    // const exportPath = file.appConfigDir + "/iina_keybindings.csv";
    // file.write(exportPath, exportText.trim()); // trim removes the leading newline for the file
    // core.osd(`Exported to: ${exportPath}`);

    core.osd("Keybindings exported to console as CSV!");
}




function initialize(): void {
    overlay.loadFile("dist/ui/overlay/index.html");

    sidebar.loadFile("dist/ui/sidebar/index.html");
    
    const broadcastCommand = () => {
        const fn = appState.getCurrentFilename();
        const cmd = videoProcessor.commandBuilder._buildClipboardCommand(fn);
        sidebar.postMessage("command-result", { command: cmd });
    };
    sidebar.onMessage("toggle-pause", () => {
        if (core.status.paused) {
            core.resume();
        } else {
            core.pause();
        }
    });

    sidebar.onMessage("set-start-time", () => {
        const t = videoProcessor.setTimePosition(0);
        core.osd(`Start time: ${t}`);
        const payload: IPCTimeUpdateMessage = { type: "start", time: t };
        sidebar.postMessage("time-update", payload);
        broadcastCommand();
    });

    sidebar.onMessage("set-end-time", () => {
        const t = videoProcessor.setTimePosition(1);
        core.osd(`End time: ${t}`);
        const payload: IPCTimeUpdateMessage = { type: "end", time: t };
        sidebar.postMessage("time-update", payload);
        broadcastCommand();
    });

    sidebar.onMessage("request-sync", () => {
        const payload: IPCSyncStateMessage = {
            startTime: appState.timeArr[0],
            endTime: appState.timeArr[1],
            filename: appState.outputFilename,
            useCrop: appState.useCrop,
            cropString: CoordinateUtils.cropToCoordsString(appState.normalizedCoordinates) || "",
            showHud: appState.showHud
        };
        sidebar.postMessage("sync-state", payload);
    });

    sidebar.onMessage("set-filename", (data: IPCSetFilenameMessage) => {
        appState.outputFilename = data.filename;
        broadcastCommand();
    });

    sidebar.onMessage("set-output-dir", () => {
        void UserPrompts.promptOutputDir().then((newDir) => {
            if (newDir) {
                appState.outputDir = newDir;
                core.osd(`Output directory: ${newDir}`);
                broadcastCommand();
            }
        });
    });

    sidebar.onMessage("toggle-crop", () => {
        videoProcessor.toggleCrop();
        sendClickState();
        broadcastCommand();
    });

    sidebar.onMessage("toggle-hud", () => {
        appState.showHud = !appState.showHud;
        if (appState.showHud || appState.useCrop) {
            overlay.show();
        } else {
            overlay.hide();
        }
        const payload: IPCUpdateMessage = {
            time: TimeUtils.secondsToISO(core.status.position || 0),
            videoFrame: core.window.frame,
            videoWidth: core.status.videoWidth || 0,
            videoHeight: core.status.videoHeight || 0,
            scale: appState.scale || 1,
            showHud: appState.showHud,
        };
        overlay.postMessage("update", payload);
    });

    sidebar.onMessage("set-crop-string", (data: IPCSetCropStringMessage) => {
        if (videoProcessor.setCropFromString(data.cropString)) {
            sendClickState();
            broadcastCommand();
        }
    });

    sidebar.onMessage("get-command", () => {
        broadcastCommand();
    });

    sidebar.onMessage("run-ffmpeg", () => {
        void videoProcessor.executeFFMPEG(true);
    });

    setupEventListeners();
    setupMenus(appState, videoProcessor);
    startIntervals();
    // exportAllKeybinds();
}

initialize();

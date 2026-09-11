const { menu, core, preferences, overlay, console } = iina;
import { UserPrompts } from "./utils";
import { AppState, VideoProcessor, FFMPEGCommandBuilder } from "./core";
import * as helpers from "./helpers";

// Track visibility for the toggle shortcut
let isOverlayVisible = true;

export function setupMenus(appState: AppState, videoProcessor: VideoProcessor): void {
    // 1. Options Menu
    const subOptionsMenu = menu.item("Options");

    subOptionsMenu.addSubMenuItem(
        menu.item(
            "Set start time",
            () => {
                const startTime = videoProcessor.setTimePosition(0);
                core.osd(`Start time set to: ${startTime}`);
            },
            { keyBinding: "Alt+s" },
        ),
    );

    subOptionsMenu.addSubMenuItem(
        menu.item(
            "Set end time",
            () => {
                const endTime = videoProcessor.setTimePosition(1);
                core.osd(`End time set to: ${endTime}`);
            },
            { keyBinding: "Alt+e" },
        ),
    );

    // --- ADDED KEYBINDING HERE ---
    subOptionsMenu.addSubMenuItem(
        menu.item(
            "Set output directory",
            () => {
                void UserPrompts.promptOutputDir().then((newDir) => {
                    if (newDir) {
                        appState.outputDir = newDir;
                        core.osd(`Output directory: ${newDir}`);
                    }
                });
            },
            { keyBinding: "Alt+d" }
        ),
    );

    subOptionsMenu.addSubMenuItem(
        menu.item(
            "Set output filename",
            () => {
                const filename = UserPrompts.promptOutputFilename(
                    appState.getCurrentFilename(),
                );
                if (filename) {
                    appState.outputFilename = filename;
                }
            },
            { keyBinding: "Alt+f" },
        ),
    );

    subOptionsMenu.addSubMenuItem(
        menu.item(
            "Toggle crop",
            () => {
                videoProcessor.toggleCrop();
            },
            { keyBinding: "Meta+T" },
        ),
    );

    subOptionsMenu.addSubMenuItem(
        menu.item(
            "Edit crop",
            () => {
                videoProcessor.editCrop();
            },
            { keyBinding: "Meta+E" },
        ),
    );

    // 2. FFMPEG Menu
    const subFFMPEGMenu = menu.item("FFMPEG");

    subFFMPEGMenu.addSubMenuItem(
        menu.item("Initialise ffmpeg", () => {
            helpers.initFFMPEG();
        }),
    );

    subFFMPEGMenu.addSubMenuItem(
        menu.item("Download ffmpeg", () => {
            helpers.downloadFFMPEG().then((result) => {
                if (result === true) {
                    console.log("Now running the next step...");
                    helpers.unzip().then(() => {
                        helpers.logger("Download and extract successful.");
                    });
                } else {
                    console.error(`Download failed: ${result}`);
                }
            });
        }),
    );

    subFFMPEGMenu.addSubMenuItem(
        menu.item("Show ffmpeg path", () => {
            const ffPath = preferences.get("ffmpeg_path");
            core.osd(ffPath);
        }),
    );

    subFFMPEGMenu.addSubMenuItem(
        menu.item("Show command", () => {
            const commandBuilder = new FFMPEGCommandBuilder(appState);
            const command = commandBuilder.buildCommand(true);
            if (command && typeof command !== "string" && command.args) {
                UserPrompts.showCommand(`ffmpeg ${command.args.join(" ")}`);
                console.log(command);
            }
        }),
    );

    subFFMPEGMenu.addSubMenuItem(
        menu.item(
            "Run ffmpeg",
            () => {
                void videoProcessor.executeFFMPEG();
            },
            { keyBinding: "Command+Shift+R" },
        ),
    );

    // 3. Overlay Menu
    const subOverlayMenu = menu.item("Overlay");

    // --- ADDED TOGGLE WITH KEYBINDING ---
    subOverlayMenu.addSubMenuItem(
        menu.item(
            "Toggle Video Overlay",
            () => {
                isOverlayVisible = !isOverlayVisible;
                if (isOverlayVisible) {
                    overlay.show();
                    core.osd("Overlay: ON");
                } else {
                    overlay.hide();
                    core.osd("Overlay: OFF");
                }
            },
            { keyBinding: "Alt+h" }
        )
    );

    // Kept your explicit Show/Hide buttons for mouse users, updating the state so they stay in sync
    subOverlayMenu.addSubMenuItem(
        menu.item("Show Video Overlay", () => {
            overlay.show();
            isOverlayVisible = true;
        }),
    );

    subOverlayMenu.addSubMenuItem(
        menu.item("Hide Video Overlay", () => {
            overlay.hide();
            isOverlayVisible = false;
        }),
    );

    // Add them all to the main menu
    menu.addItem(subOptionsMenu);
    menu.addItem(subFFMPEGMenu);
    menu.addItem(subOverlayMenu);
}

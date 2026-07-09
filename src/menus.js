const { menu, core, preferences, overlay, console } = iina;
import { UserPrompts } from "./utils";
import { FFMPEGCommandBuilder } from "./core";
import * as helpers from "./helpers";

export function setupMenus(appState, videoProcessor) {
  // 1. Options Menu
  const subOptionsMenu = menu.item("Options");
  subOptionsMenu.addSubMenuItem(menu.item("Set start time", () => {
    const startTime = videoProcessor.setTimePosition(0);
    core.osd(`Start time set to: ${startTime}`);
  }, { keyBinding: "U" }));
  subOptionsMenu.addSubMenuItem(
    menu.item(
      "Set end time",
      () => {
        const endTime = videoProcessor.setTimePosition(1);
        core.osd(`End time set to: ${endTime}`);
      },
      { keyBinding: "Meta+u" },
    ),
  );

  subOptionsMenu.addSubMenuItem(
    menu.item("Set output directory", async () => {
      const newDir = await UserPrompts.promptOutputDir();
      if (newDir) {
        appState.outputDir = newDir;
      }
    }),
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
      { keyBinding: "Shift+Meta+u" },
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
  subFFMPEGMenu.addSubMenuItem(menu.item("Initialise ffmpeg", () => {
    helpers.initFFMPEG();
  }));
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
      if (command) {
        core.osd(`ffmpeg ${command.args.join(" ")}`);
        console.log(command);
      }
    }),
  );

  subFFMPEGMenu.addSubMenuItem(
    menu.item(
      "Run ffmpeg",
      async () => {
        await videoProcessor.executeFFMPEG();
      },
      { keyBinding: "Command+Shift+R" },
    ),
  );
  // 3. Overlay Menu
  const subOverlayMenu = menu.item("Overlay");
  subOverlayMenu.addSubMenuItem(menu.item("Show Video Overlay", () => overlay.show()));
  subOverlayMenu.addSubMenuItem(menu.item("Hide Video Overlay", () => overlay.hide()));

  // Add them all to the main menu
  menu.addItem(subOptionsMenu);
  menu.addItem(subFFMPEGMenu);
  menu.addItem(subOverlayMenu);
}

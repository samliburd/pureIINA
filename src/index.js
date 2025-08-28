const {
  standaloneWindow,
  overlay,
  console,
  menu,
  core,
  input,
  utils,
  file,
  preferences,
  playlist,
} = iina;
import * as helpers from "./helpers";

// Constants
const REGEX_WHITESPACE = /\s/g;
const DEFAULT_START_TIME = "00:00:00.000";
const VIDEO_EXTENSIONS =
  /[-\w\s\.]+\.(mp4|webm|mkv|avi|m4v|mov|flv|ogv|3gp|wmv|mts|m2ts|ts)/gim;
const FFMPEG_DEFAULTS = {
  codec: "libx264",
  crf: 17,
  preset: "fast",
  audioCodec: "aac",
  container: "mp4",
};

// Application State
class AppState {
  constructor() {
    this.dimensions = null;
    this.frame = null;
    this.scale = null;
    this.rectangleCoordinates = null;
    this.normalizedCoordinates = null;
    this.firstClickPos = { x: 0, y: 0 };
    this.secondClickPos = { x: 0, y: 0 };
    this.isWaitingForSecondClick = false;
    this.isHidden = true;
    this.timeArr = [DEFAULT_START_TIME, this.getFormattedDuration()];
    this.outputDir = preferences.get("output_dir");
    this.outputFilename = "";
    this.useCrop = false;
    this.startTime = DEFAULT_START_TIME;
    this.endTime = this.getFormattedDuration();
  }

  getFormattedDuration() {
    return TimeUtils.secondsToISO(core.status.duration);
  }

  getCurrentFilename() {
    return core.status.url
      .replace("file://", "")
      .replace(REGEX_WHITESPACE, "\\ ");
  }

  reset() {
    this.firstClickPos = { x: 0, y: 0 };
    this.secondClickPos = { x: 0, y: 0 };
    this.isWaitingForSecondClick = false;
  }
}

// Utility Classes
class TimeUtils {
  static secondsToISO(time) {
    return new Date(time * 1000).toISOString().substring(11, 23);
  }

  static getCurrentTimePosition() {
    return TimeUtils.secondsToISO(core.status.position);
  }
}

class CoordinateUtils {
  static getRectangleCoordinates(firstClick, secondClick) {
    const x1 = firstClick.x;
    const y1 = firstClick.y;
    const x2 = secondClick.x;
    const y2 = secondClick.y;

    return {
      x: Math.round(Math.min(x1, x2)),
      y: Math.round(Math.min(y1, y2)),
      width: Math.round(Math.abs(x2 - x1)),
      height: Math.round(Math.abs(y2 - y1)),
    };
  }

  static getNormalizedCoordinates(coordinates, scale) {
    return {
      x: Math.round(coordinates.x * scale),
      y: Math.round(coordinates.y * scale),
      width: Math.round(coordinates.width * scale),
      height: Math.round(coordinates.height * scale),
    };
  }
}

class FFMPEGCommandBuilder {
  constructor(state) {
    this.state = state;
  }

  validate() {
    const errors = [];

    if (!this.state.timeArr[0] || !this.state.timeArr[1]) {
      errors.push("Start and end times must be set");
    }

    if (this.state.useCrop && !this.state.normalizedCoordinates) {
      errors.push("Crop area must be selected when crop is enabled");
    }

    return errors;
  }

  buildCommand(direct = false) {
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      core.osd(`Error: ${validationErrors.join(", ")}`);
      return null;
    }

    const filename = this.state.getCurrentFilename();

    if (direct) {
      return this._buildDirectCommand(filename);
    } else {
      return this._buildClipboardCommand(filename);
    }
  }

  _buildDirectCommand(filename) {
    if (!this.state.outputFilename) {
      const promptedFilename = UserPrompts.promptOutputFilename(filename);
      if (!promptedFilename) {
        core.osd("Output filename not provided. Operation cancelled.");
        return null;
      }
      this.state.outputFilename = promptedFilename;
    }

    const finalOutputFilename = `${this.state.outputDir}/${this.state.outputFilename}`;
    const baseArgs = [
      "-ss",
      this.state.timeArr[0],
      "-to",
      this.state.timeArr[1],
      "-i",
      filename,
    ];

    const videoArgs = this.state.useCrop
      ? [
          "-vf",
          `crop=${this.state.normalizedCoordinates.width}:${this.state.normalizedCoordinates.height}:${this.state.normalizedCoordinates.x}:${this.state.normalizedCoordinates.y}`,
        ]
      : [];

    const encodingArgs = [
      "-c:v",
      FFMPEG_DEFAULTS.codec,
      "-crf",
      FFMPEG_DEFAULTS.crf.toString(),
      "-preset",
      FFMPEG_DEFAULTS.preset,
      "-c:a",
      FFMPEG_DEFAULTS.audioCodec,
      "-ac",
      "2",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-movflags",
      "+faststart",
      finalOutputFilename,
    ];

    return {
      args: [...baseArgs, ...videoArgs, ...encodingArgs].filter(
        (arg) => arg !== "",
      ),
      outputFilename: finalOutputFilename,
    };
  }

  _buildClipboardCommand(filename) {
    const cropFilter = this.state.useCrop
      ? `-vf "crop=${this.state.normalizedCoordinates.width}:${this.state.normalizedCoordinates.height}:${this.state.normalizedCoordinates.x}:${this.state.normalizedCoordinates.y}" \\`
      : "\\";

    return `ffmpeg -ss ${this.state.timeArr[0]} -to ${this.state.timeArr[1]} -i ${filename} ${cropFilter}
-c:v ${FFMPEG_DEFAULTS.codec} -crf ${FFMPEG_DEFAULTS.crf} -preset ${FFMPEG_DEFAULTS.preset} -c:a ${FFMPEG_DEFAULTS.audioCodec} -ac 2 -map_metadata -1 -map_chapters -1 -movflags +faststart ${this.state.outputFilename} && echo ${this.state.outputFilename}`;
  }
}

class UserPrompts {
  static promptOutputFilename(currentFilename) {
    const fn = utils.prompt(`Please enter the file name\n\n${currentFilename}`);
    return fn ? `${fn}.${FFMPEG_DEFAULTS.container}` : null;
  }

  static async promptOutputDir() {
    try {
      const tempOutput = await utils.chooseFile(
        "Please select the output directory\n",
        { chooseDir: true },
      );

      if (tempOutput) {
        core.osd(`Output directory set to: ${tempOutput}`);
        return tempOutput;
      } else {
        core.osd("No directory selected");
        return null;
      }
    } catch (error) {
      core.osd(`Error selecting directory: ${error}`);
      return null;
    }
  }

  static confirmAction(message) {
    return utils.ask(message);
  }
}

class OverlayManager {
  constructor(state) {
    this.state = state;
    this._initialize();
  }

  _initialize() {
    overlay.loadFile("dist/ui/overlay/index.html");
    overlay.setClickable(true);
  }

  updateOverlay() {
    overlay.postMessage("update", {
      dimensions: this.state.dimensions,
      windowSize: this.state.frame,
      firstClick: this.state.firstClickPos,
      secondClick: this.state.secondClickPos,
      rectangleCoordinates: this.state.rectangleCoordinates,
      normalizedCoordinates: this.state.normalizedCoordinates,
      isHidden: this.state.isHidden,
    });
  }

  clearRectangle() {
    overlay.postMessage("clear-rectangle");
  }

  show() {
    overlay.show();
  }

  hide() {
    overlay.hide();
  }
}

class VideoProcessor {
  constructor(state) {
    this.state = state;
    this.commandBuilder = new FFMPEGCommandBuilder(state);
  }

  updateVideoVariables() {
    this.state.dimensions = {
      videoWidth: core.status.videoWidth,
      videoHeight: core.status.videoHeight,
    };
    this.state.frame = core.window.frame;
    this.state.scale =
      this.state.dimensions.videoWidth / this.state.frame.width;

    if (this.state.firstClickPos.x !== 0 && this.state.secondClickPos.x !== 0) {
      this.state.rectangleCoordinates = CoordinateUtils.getRectangleCoordinates(
        this.state.firstClickPos,
        this.state.secondClickPos,
      );
      this.state.normalizedCoordinates =
        CoordinateUtils.getNormalizedCoordinates(
          this.state.rectangleCoordinates,
          this.state.scale,
        );
    }
  }

  handleMouseClick(x, y) {
    if (!this.state.useCrop) return;

    overlayManager.show();
    core.osd(x.toString());

    const adjustedY = Math.round(core.window.frame.height - y);

    if (!this.state.isWaitingForSecondClick) {
      this.state.firstClickPos = { x: Math.round(x), y: adjustedY };
      this.state.isWaitingForSecondClick = true;
    } else {
      this.state.secondClickPos = { x: Math.round(x), y: adjustedY };
      this.state.isWaitingForSecondClick = false;
    }
  }

  setTimePosition(index) {
    const timePos = TimeUtils.getCurrentTimePosition();
    this.state.timeArr[index] = timePos;
    return timePos;
  }

  toggleCrop() {
    this.state.useCrop = !this.state.useCrop;
    core.osd(`Crop ${this.state.useCrop ? "enabled" : "disabled"}`);
  }

  async copyCommandToClipboard() {
    if (
      this.state.useCrop &&
      (this.state.secondClickPos.x === 0 || this.state.secondClickPos.y === 0)
    ) {
      core.osd("Please select a crop area before continuing.");
      return;
    }

    const command = this.commandBuilder.buildCommand(false);
    if (!command) return;

    const userConfirmed = UserPrompts.confirmAction(
      `Do you want to copy the following command to your clipboard?\n\n${command}`,
    );

    if (userConfirmed) {
      try {
        const { status, stderr } = await utils.exec("/bin/bash", [
          "-c",
          `echo "${command}" | pbcopy`,
        ]);

        if (status === 0) {
          core.osd("Command copied to clipboard");
        } else {
          core.osd(`Failed to copy to clipboard: ${stderr}`);
        }
      } catch (error) {
        core.osd(`Error copying to clipboard: ${error}`);
      }
    } else {
      core.osd("User cancelled");
    }
  }

  async executeFFMPEG() {
    const commandResult = this.commandBuilder.buildCommand(true);
    if (!commandResult) return;

    const { args, outputFilename } = commandResult;
    const cleanedArgs = args.filter((entry) => entry !== "");

    const userConfirmed = UserPrompts.confirmAction(
      `Do you want to run this ffmpeg command:\n\nffmpeg ${cleanedArgs.join(" ")}`,
    );

    if (userConfirmed) {
      const inputFilename = this.state
        .getCurrentFilename()
        .replace(/\\ /g, " ");
      helpers.logger(`Processing ${inputFilename} -> ${outputFilename}`);

      try {
        const result = await helpers.callFFMPEG(cleanedArgs);
        if (result.status === 0) {
          helpers.logger(`Video successfully processed: ${outputFilename}`);
        } else {
          helpers.logger(`FFmpeg failed with status: ${result.status}`);
        }
      } catch (error) {
        helpers.logger(`Error executing FFmpeg: ${error}`);
      }
    }
  }
}

// Initialize application
const appState = new AppState();
const overlayManager = new OverlayManager(appState);
const videoProcessor = new VideoProcessor(appState);

// Event Handlers
function setupEventListeners() {
  // Mouse events
  input.onMouseDown(input.MOUSE, () => {
    input.onMouseUp(input.MOUSE, ({ x, y }) => {
      videoProcessor.handleMouseClick(x, y);
    });
  });

  // Keyboard shortcuts
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
  });

  input.onKeyDown("alt+c", () => {
    appState.reset();
    overlayManager.clearRectangle();
    core.osd("Crop cancelled.");
  });

  input.onKeyDown("h", () => {
    appState.isHidden = !appState.isHidden;
  });

  input.onKeyDown("alt+k", async () => {
    await videoProcessor.copyCommandToClipboard();
  });
}

// Menu Setup
function setupMenus() {
  setupOverlayMenu();
  setupOptionsMenu();
  setupFFMPEGMenu();
}

function setupOverlayMenu() {
  const subOverlayMenu = menu.item("Overlay");

  // Keep playlist functionality as requested
  subOverlayMenu.addSubMenuItem(
    menu.item("List files", () => {
      listFiles();
    }),
  );

  subOverlayMenu.addSubMenuItem(
    menu.item("Show Video Overlay", () => {
      core.osd("Show Video Overlay");
      overlayManager.show();
    }),
  );

  subOverlayMenu.addSubMenuItem(
    menu.item("Hide Video Overlay", () => {
      overlayManager.hide();
    }),
  );

  menu.addItem(subOverlayMenu);
}

function setupOptionsMenu() {
  const subOptionsMenu = menu.item("Options");

  subOptionsMenu.addSubMenuItem(
    menu.item(
      "Set start time",
      () => {
        const startTime = videoProcessor.setTimePosition(0);
        core.osd(`Start time set to: ${startTime}`);
      },
      { keyBinding: "U" },
    ),
  );

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

  menu.addItem(subOptionsMenu);
}

function setupFFMPEGMenu() {
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

  menu.addItem(subFFMPEGMenu);
}

// Keep original playlist function as requested
async function listFiles() {
  const playlistDir = await utils.chooseFile("Select playlist directory", {
    chooseDir: true,
  });
  const { status, stdout, stderr } = await utils.exec("/bin/bash", [
    "-c",
    `ls ${playlistDir}`,
  ]);
  const filesArray = stdout.split("\n");
  const videoFiles = filesArray
    .filter((file) => file.match(VIDEO_EXTENSIONS))
    .map((file) => {
      return `${playlistDir}/${file}`;
    });

  videoFiles.reverse().forEach((file) => {
    playlist.add(file);
  });
  console.log(typeof playlist.list);
}

// Application Initialization
function initialize() {
  setupEventListeners();
  setupMenus();

  // Periodic updates
  setInterval(() => {
    videoProcessor.updateVideoVariables();
    overlayManager.updateOverlay();
  }, 500);
}

// Start the application
initialize();

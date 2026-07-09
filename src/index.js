const {
  standaloneWindow,
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

// ============================================================================
// CONSTANTS
// ============================================================================
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

// ============================================================================
// UTILITY CLASSES
// ============================================================================
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

  static parseCropString(cropString) {
    const parts = cropString.split(":");
    if (parts.length !== 4) {
      return null;
    }

    const [width, height, x, y] = parts.map((part) =>
      parseInt(part.trim(), 10),
    );

    if (parts.some((part) => isNaN(parseInt(part.trim(), 10)))) {
      return null;
    }

    return { width, height, x, y };
  }

  static cropToCoordsString(normalizedCoordinates) {
    if (!normalizedCoordinates) {
      return "0:0:0:0";
    }
    return `${normalizedCoordinates.width}:${normalizedCoordinates.height}:${normalizedCoordinates.x}:${normalizedCoordinates.y}`;
  }

  static denormalizeCoordinates(normalizedCoords, scale) {
    return {
      x: Math.round(normalizedCoords.x / scale),
      y: Math.round(normalizedCoords.y / scale),
      width: Math.round(normalizedCoords.width / scale),
      height: Math.round(normalizedCoords.height / scale),
    };
  }

  static coordsToClickPositions(coordinates, frameHeight) {
    const firstClick = {
      x: coordinates.x,
      y: frameHeight - coordinates.y,
    };

    const secondClick = {
      x: coordinates.x + coordinates.width,
      y: frameHeight - (coordinates.y + coordinates.height),
    };

    return { firstClick, secondClick };
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

  static promptCropEdit(currentCrop) {
    const helpText = `Edit Crop Area\n\nCurrent crop: crop=${currentCrop}\n\nEnter crop values in format: width:height:x:y\n- width: crop width in pixels\n- height: crop height in pixels  \n- x: horizontal offset from left\n- y: vertical offset from top\n\nExample: 1280:720:100:50\n\nCurrent crop: ${currentCrop}`;
    return utils.prompt(helpText);
  }
}

// ============================================================================
// CORE DOMAIN CLASSES
// ============================================================================
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

    return `ffmpeg -ss ${this.state.timeArr[0]} -to ${this.state.timeArr[1]} -i ${filename} ${cropFilter}\n-c:v ${FFMPEG_DEFAULTS.codec} -crf ${FFMPEG_DEFAULTS.crf} -preset ${FFMPEG_DEFAULTS.preset} -c:a ${FFMPEG_DEFAULTS.audioCodec} -ac 2 -map_metadata -1 -map_chapters -1 -movflags +faststart ${this.state.outputFilename} && echo ${this.state.outputFilename}`;
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

  editCrop() {
    if (!this.state.useCrop) {
      this.state.useCrop = true;
    }

    const currentCrop = CoordinateUtils.cropToCoordsString(
      this.state.normalizedCoordinates,
    );

    const userInput = UserPrompts.promptCropEdit(currentCrop);

    if (!userInput) {
      core.osd("Crop edit cancelled");
      return;
    }

    const parsedCrop = CoordinateUtils.parseCropString(userInput);

    if (!parsedCrop) {
      core.osd(
        "Invalid crop format. Please use width:height:x:y format (e.g., 1280:720:100:50)",
      );
      return;
    }

    const { videoWidth, videoHeight } = this.state.dimensions;

    if (parsedCrop.width <= 0 || parsedCrop.height <= 0) {
      core.osd("Crop width and height must be greater than 0");
      return;
    }

    if (parsedCrop.x < 0 || parsedCrop.y < 0) {
      core.osd("Crop x and y coordinates must be 0 or greater");
      return;
    }

    if (
      parsedCrop.x + parsedCrop.width > videoWidth ||
      parsedCrop.y + parsedCrop.height > videoHeight
    ) {
      core.osd(
        `Crop area exceeds video dimensions (${videoWidth}x${videoHeight})`,
      );
      return;
    }

    this.state.normalizedCoordinates = parsedCrop;

    this.state.rectangleCoordinates = CoordinateUtils.denormalizeCoordinates(
      parsedCrop,
      this.state.scale,
    );

    const { firstClick, secondClick } = CoordinateUtils.coordsToClickPositions(
      this.state.rectangleCoordinates,
      this.state.frame.height,
    );

    this.state.firstClickPos = firstClick;
    this.state.secondClickPos = secondClick;
    this.state.isWaitingForSecondClick = false;

    core.osd(
      `Crop set to: ${parsedCrop.width}:${parsedCrop.height}:${parsedCrop.x}:${parsedCrop.y}`,
    );
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

// ============================================================================
// APPLICATION SETUP & ENTRY
// ============================================================================

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
    core.osd("Crop cancelled.");
  });

  input.onKeyDown("alt+k", async () => {
    await videoProcessor.copyCommandToClipboard();
  });
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

  subOptionsMenu.addSubMenuItem(
    menu.item(
      "Edit crop",
      () => {
        videoProcessor.editCrop();
      },
      { keyBinding: "Meta+E" },
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

function setupMenus() {
  setupOptionsMenu();
  setupFFMPEGMenu();
}

function initialize() {
  setupEventListeners();
  setupMenus();

  // Periodic updates
  setInterval(() => {
    videoProcessor.updateVideoVariables();
  }, 500);
}

// Start the application
initialize();

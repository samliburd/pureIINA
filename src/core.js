const { core, preferences, utils } = iina;
import { DEFAULT_START_TIME, FFMPEG_DEFAULTS, REGEX_WHITESPACE } from "./constants";
import { TimeUtils, CoordinateUtils, UserPrompts } from "./utils";
import * as helpers from "./helpers";

export class AppState {
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
    return decodeURIComponent(core.status.url.replace("file://", ""));
  }

  reset() {
    this.firstClickPos = { x: 0, y: 0 };
    this.secondClickPos = { x: 0, y: 0 };
    this.isWaitingForSecondClick = false;
  }
}

export class FFMPEGCommandBuilder {
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
    const escapedFilename = filename.replace(REGEX_WHITESPACE, "\\ ");
    const cropFilter = this.state.useCrop
      ? `-vf "crop=${this.state.normalizedCoordinates.width}:${this.state.normalizedCoordinates.height}:${this.state.normalizedCoordinates.x}:${this.state.normalizedCoordinates.y}" \\`
      : "\\";

    return `ffmpeg -ss ${this.state.timeArr[0]} -to ${this.state.timeArr[1]} -i ${escapedFilename} ${cropFilter}\n-c:v ${FFMPEG_DEFAULTS.codec} -crf ${FFMPEG_DEFAULTS.crf} -preset ${FFMPEG_DEFAULTS.preset} -c:a ${FFMPEG_DEFAULTS.audioCodec} -ac 2 -map_metadata -1 -map_chapters -1 -movflags +faststart ${this.state.outputFilename} && echo ${this.state.outputFilename}`;
  }
}

export class VideoProcessor {
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
      const inputFilename = this.state.getCurrentFilename();
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

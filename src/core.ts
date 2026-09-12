const { core, preferences, utils, sidebar } = iina;
import {
  DEFAULT_START_TIME,
  FFMPEG_DEFAULTS,
  REGEX_WHITESPACE,
} from "./constants";
import { TimeUtils, CoordinateUtils, UserPrompts } from "./utils";
import * as helpers from "./helpers";
import { Dimensions, Point, Rect, FFMPEGCommandResult } from "./types";

export class AppState {
  dimensions: Dimensions | null = null;
  frame: Rect | null = null;
  scale: number | null = null;
  rectangleCoordinates: Rect | null = null;
  normalizedCoordinates: Rect | null = null;
  firstClickPos: Point = { x: 0, y: 0 };
  secondClickPos: Point = { x: 0, y: 0 };
  isWaitingForSecondClick: boolean = false;
  isHidden: boolean = true;
  timeArr: string[];
  outputDir: string | null;
  outputFilename: string = "";
  useCrop: boolean = false;
  showHud: boolean = false;
  startTime: string;
  endTime: string;

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

    // --- UPDATED: Initialize as null instead of fetching from preferences ---
    this.outputDir = null;

    this.outputFilename = "";
    this.useCrop = false;
    this.startTime = DEFAULT_START_TIME;
    this.endTime = this.getFormattedDuration();
  }

  getFormattedDuration(): string {
    return TimeUtils.secondsToISO(core.status.duration || 0);
  }

  getCurrentFilename(): string {
    return decodeURIComponent(core.status.url.replace("file://", ""));
  }

  getInputFileDirectory(): string | null {
    const url = core.status.url;
    if (!url || !url.startsWith("file://")) return null;

    const decodedPath = decodeURIComponent(url.replace("file://", ""));
    return decodedPath.substring(0, decodedPath.lastIndexOf("/"));
  }

  reset(): void {
    this.firstClickPos = { x: 0, y: 0 };
    this.secondClickPos = { x: 0, y: 0 };
    this.isWaitingForSecondClick = false;
  }
}

export class FFMPEGCommandBuilder {
  state: AppState;

  constructor(state: AppState) {
    this.state = state;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.state.timeArr[0] || !this.state.timeArr[1]) {
      errors.push("Start and end times must be set");
    }

    if (this.state.useCrop && !this.state.normalizedCoordinates) {
      errors.push("Crop area must be selected when crop is enabled");
    }

    return errors;
  }

  buildCommand(direct: boolean = false): FFMPEGCommandResult | string | null {
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

  _buildDirectCommand(filename: string): FFMPEGCommandResult | null {
    if (!this.state.outputFilename) {
      const promptedFilename = UserPrompts.promptOutputFilename(filename);
      if (!promptedFilename) {
        core.osd("Output filename not provided. Operation cancelled.");
        return null;
      }
      this.state.outputFilename = promptedFilename;
    }

    // --- UPDATED LOGIC ---
    // Fall back to the input file's directory if outputDir is empty
    const resolvedOutputDir =
      this.state.outputDir || this.state.getInputFileDirectory();

    if (!resolvedOutputDir) {
      core.osd(
        "Error: Cannot determine output directory. Is this a local file?",
      );
      return null;
    }

    const finalOutputFilename = `${resolvedOutputDir}/${this.state.outputFilename}`;

    const baseArgs = [
      "-ss",
      this.state.timeArr[0],
      "-to",
      this.state.timeArr[1],
      "-i",
      filename,
    ];

    const videoArgs =
      this.state.useCrop && this.state.normalizedCoordinates
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

  _buildClipboardCommand(filename: string): string {
    const escapedFilename = filename.replace(REGEX_WHITESPACE, "\\ ");
    const cropFilter = this.state.useCrop
      && this.state.normalizedCoordinates
      ? `-vf "crop=${this.state.normalizedCoordinates.width}:${this.state.normalizedCoordinates.height}:${this.state.normalizedCoordinates.x}:${this.state.normalizedCoordinates.y}" \\`
      : "\\";

    return `ffmpeg -ss ${this.state.timeArr[0]} -to ${this.state.timeArr[1]} -i ${escapedFilename} ${cropFilter}\n-c:v ${FFMPEG_DEFAULTS.codec} -crf ${FFMPEG_DEFAULTS.crf} -preset ${FFMPEG_DEFAULTS.preset} -c:a ${FFMPEG_DEFAULTS.audioCodec} -ac 2 -map_metadata -1 -map_chapters -1 -movflags +faststart ${this.state.outputFilename} && echo ${this.state.outputFilename}`;
  }
}

export class VideoProcessor {
  state: AppState;
  commandBuilder: FFMPEGCommandBuilder;

  constructor(state: AppState) {
    this.state = state;
    this.commandBuilder = new FFMPEGCommandBuilder(state);
  }

  updateVideoVariables(): void {
    if (!core.window.frame || !core.status.videoWidth || !core.status.videoHeight) return;

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

  handleMouseClick(x: number, y: number): void {
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

  setTimePosition(index: number): string {
    const timePos = TimeUtils.getCurrentTimePosition();
    this.state.timeArr[index] = timePos;
    return timePos;
  }

  toggleCrop(): void {
    this.state.useCrop = !this.state.useCrop;
    core.osd(`Crop ${this.state.useCrop ? "enabled" : "disabled"}`);
  }

  editCrop(): void {
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

    this.setCropFromString(userInput);
  }

  setCropFromString(cropStr: string): boolean {
    if (!this.state.useCrop) {
      this.state.useCrop = true;
    }

    const parsedCrop = CoordinateUtils.parseCropString(cropStr);

    if (!parsedCrop) {
      core.osd(
        "Invalid crop format. Please use width:height:x:y format (e.g., 1280:720:100:50)",
      );
      return false;
    }

    if (!this.state.dimensions) return false;
    const { videoWidth, videoHeight } = this.state.dimensions;

    if (parsedCrop.width <= 0 || parsedCrop.height <= 0) {
      core.osd("Crop width and height must be greater than 0");
      return false;
    }

    if (parsedCrop.x < 0 || parsedCrop.y < 0) {
      core.osd("Crop x and y coordinates must be 0 or greater");
      return false;
    }

    if (
      parsedCrop.x + parsedCrop.width > videoWidth ||
      parsedCrop.y + parsedCrop.height > videoHeight
    ) {
      core.osd(
        `Crop area exceeds video dimensions (${videoWidth}x${videoHeight})`,
      );
      return false;
    }
    const toEven = (val: number) => Math.round(val / 2) * 2;
    parsedCrop.width = toEven(parsedCrop.width);
    parsedCrop.height = toEven(parsedCrop.height);
    parsedCrop.x = toEven(parsedCrop.x);
    parsedCrop.y = toEven(parsedCrop.y);

    this.state.normalizedCoordinates = parsedCrop;

    if (!this.state.scale || !this.state.frame) return false;

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
    return true;
  }

  async copyCommandToClipboard(): Promise<void> {
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

  async executeFFMPEG(skipConfirmation: boolean = false): Promise<void> {
    const commandResult = this.commandBuilder.buildCommand(true);
    if (
      !commandResult ||
      typeof commandResult === "string" ||
      !("args" in commandResult)
    )
      return;

    const { args, outputFilename } = commandResult;
    const cleanedArgs = args.filter((entry) => entry !== "");

    let userConfirmed = true;
    if (!skipConfirmation) {
      userConfirmed = UserPrompts.confirmAction(
        `Do you want to run this ffmpeg command:\n\nffmpeg ${cleanedArgs.join(" ")}`,
      );
    }

    if (userConfirmed) {
      const inputFilename = this.state.getCurrentFilename();
      helpers.logger(`Processing ${inputFilename} -> ${outputFilename}`);

      try {
        const startSec = TimeUtils.isoToSeconds(this.state.timeArr[0]);
        const endSec = TimeUtils.isoToSeconds(this.state.timeArr[1]);
        const durationUs = (endSec - startSec) * 1_000_000;

        sidebar.postMessage("ffmpeg-progress", { progress: 0 });

        let lastOsdPct = -1;

        const result = await helpers.callFFMPEG(cleanedArgs, (timeUs) => {
          if (durationUs > 0) {
            let pct = (timeUs / durationUs) * 100;
            if (pct > 100) pct = 100;
            if (pct < 0) pct = 0;
            sidebar.postMessage("ffmpeg-progress", { progress: pct });

            if (!skipConfirmation) {
              const currentDecile = Math.floor(pct / 10) * 10;
              if (currentDecile > lastOsdPct) {
                core.osd(`Encoding Progress: ${currentDecile}%`);
                lastOsdPct = currentDecile;
              }
            }
          }
        });

        sidebar.postMessage("ffmpeg-progress", { progress: null });

        if (result.status === 0) {
          helpers.logger(`Video successfully processed: ${outputFilename}`);
          sidebar.postMessage("ffmpeg-result", { message: `Output saved to:\n${outputFilename}`, error: false });
        } else {
          helpers.logger(`FFmpeg failed with status: ${result.status}`);
          sidebar.postMessage("ffmpeg-result", { message: `Error: ${result.stderr || 'Unknown error'}`, error: true });
        }
      } catch (error: any) {
        sidebar.postMessage("ffmpeg-progress", { progress: null });
        sidebar.postMessage("ffmpeg-result", { message: `Error: ${error.message || error}`, error: true });
        helpers.logger(`Error executing FFmpeg: ${error}`);
      }
    }
  }
}

const { core, preferences, utils, sidebar, mpv } = iina;
import {
  DEFAULT_START_TIME,
  FFMPEG_DEFAULTS,
  REGEX_WHITESPACE,
  CODEC_CONFIGS,
  DEFAULT_CODEC,
} from "./constants";
import { TimeUtils, CoordinateUtils, UserPrompts } from "./utils";
import * as helpers from "./helpers";
import { Dimensions, Point, Rect, FFMPEGCommandResult, VideoCodec } from "./types";

export class AppState {
  dimensions: Dimensions | null = null;
  frame: Rect | null = null;
  scale: number | null = null;
  offsetX: number = 0;
  offsetY: number = 0;
  rectangleCoordinates: Rect | null = null;
  normalizedCoordinates: Rect | null = null;
  isHidden: boolean = true;
  timeArr: string[];
  outputDir: string | null;
  outputFilename: string = "";
  useCrop: boolean = false;
  showHud: boolean = false;
  startTime: string;
  endTime: string;
  isHDR: boolean = false;
  codec: VideoCodec = DEFAULT_CODEC;
  tlsVerify: boolean = true;

  constructor() {
    this.dimensions = null;
    this.frame = null;
    this.scale = null;
    this.rectangleCoordinates = null;
    this.normalizedCoordinates = null;
    this.isHidden = true;
    this.timeArr = [DEFAULT_START_TIME, this.getFormattedDuration()];

    const prefOutputDir = preferences.get("output_dir");
    if (prefOutputDir && typeof prefOutputDir === "string" && prefOutputDir.trim().length > 0) {
      this.outputDir = prefOutputDir.trim();
    } else {
      this.outputDir = null;
    }

    this.outputFilename = "";

    const defaultCrop = preferences.get("crop_mode_default");
    this.useCrop = Boolean(defaultCrop);
    this.showHud = Boolean(defaultCrop);

    this.startTime = DEFAULT_START_TIME;
    this.endTime = this.getFormattedDuration();

    const savedCodec = preferences.get("codec") || preferences.get("video_codec");
    if (savedCodec && ["x264", "x265", "h264_videotoolbox", "hevc_videotoolbox"].includes(savedCodec)) {
      this.codec = savedCodec as VideoCodec;
    } else {
      this.codec = DEFAULT_CODEC;
    }
  }

  getResolvedOutputDir(): string | null {
    if (this.outputDir && this.outputDir.trim().length > 0) {
      return this.outputDir.trim();
    }
    const prefOutputDir = preferences.get("output_dir");
    if (prefOutputDir && typeof prefOutputDir === "string" && prefOutputDir.trim().length > 0) {
      return prefOutputDir.trim();
    }
    return this.getInputFileDirectory();
  }

  getFormattedDuration(): string {
    return TimeUtils.secondsToISO(core.status.duration || 0);
  }

  getCurrentFilename(): string {
    return decodeURIComponent(core.status.url.replace("file://", ""));
  }

  getInputUrl(): string {
    return core.status.url || mpv.getString("path") || "";
  }

  isNetworkUrl(): boolean {
    const url = this.getInputUrl().toLowerCase();
    return url.startsWith("http://") || url.startsWith("https://");
  }

  getDefaultOutputFilename(): string {
    const fn = this.getCurrentFilename();
    if (this.isNetworkUrl()) {
      try {
        const cleanUrl = fn.split("?")[0].split("#")[0];
        const lastPart = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
        if (lastPart && lastPart.includes(".")) {
          const dotIdx = lastPart.lastIndexOf(".");
          return `${lastPart.substring(0, dotIdx)}.output.${FFMPEG_DEFAULTS.container}`;
        }
      } catch {
        // Fallback to generic output name
      }
      return `output.${FFMPEG_DEFAULTS.container}`;
    }
    return `${fn}.output.${FFMPEG_DEFAULTS.container}`;
  }

  getInputFileDirectory(): string | null {
    const url = core.status.url;
    if (!url || !url.startsWith("file://")) return null;

    const decodedPath = decodeURIComponent(url.replace("file://", ""));
    return decodedPath.substring(0, decodedPath.lastIndexOf("/"));
  }

  reset(): void {
    // Legacy reset properties removed
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
      this.state.outputFilename = this.state.getDefaultOutputFilename();
    }

    // Output dir precedence: Session outputDir > Preferences output_dir > Input file directory
    const resolvedOutputDir = this.state.getResolvedOutputDir();

    if (!resolvedOutputDir) {
      core.osd(
        "Error: Cannot determine output directory. Is this a local file?",
      );
      return null;
    }

    const finalOutputFilename = this.state.outputFilename.startsWith("/") 
      ? this.state.outputFilename 
      : `${resolvedOutputDir}/${this.state.outputFilename}`;

    const isNetwork = filename.startsWith("http://") || filename.startsWith("https://") || this.state.isNetworkUrl();
    const tlsArgs = (!this.state.tlsVerify && isNetwork) ? ["-tls_verify", "0"] : [];

    const baseArgs = [
      ...tlsArgs,
      "-ss",
      this.state.timeArr[0],
      "-to",
      this.state.timeArr[1],
      "-i",
      filename,
    ];

    let filterString = "";
    if (this.state.useCrop && this.state.normalizedCoordinates) {
      filterString += `crop=${this.state.normalizedCoordinates.width}:${this.state.normalizedCoordinates.height}:${this.state.normalizedCoordinates.x}:${this.state.normalizedCoordinates.y}`;
    }

    if (this.state.isHDR) {
      const hdrFilter = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
      filterString = filterString ? `${filterString},${hdrFilter}` : hdrFilter;
    }

    const videoArgs = filterString ? ["-vf", filterString] : [];

    const codecConfig =
      CODEC_CONFIGS[this.state.codec] || CODEC_CONFIGS[DEFAULT_CODEC];

    const encodingArgs = [
      "-c:v",
      codecConfig.encoder,
      ...(this.state.isHDR
        ? [
            "-pix_fmt",
            "yuv420p",
            "-colorspace",
            "bt709",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
          ]
        : []),
      codecConfig.qualityFlag,
      codecConfig.qualityValue.toString(),
      ...(codecConfig.preset ? ["-preset", codecConfig.preset] : []),
      ...(codecConfig.tag ? ["-tag:v", codecConfig.tag] : []),
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
    
    let filterString = "";
    if (this.state.useCrop && this.state.normalizedCoordinates) {
      filterString += `crop=${this.state.normalizedCoordinates.width}:${this.state.normalizedCoordinates.height}:${this.state.normalizedCoordinates.x}:${this.state.normalizedCoordinates.y}`;
    }

    if (this.state.isHDR) {
      const hdrFilter = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
      filterString = filterString ? `${filterString},${hdrFilter}` : hdrFilter;
    }

    const cropFilter = filterString ? `-vf "${filterString}" \\` : "\\";
    
    const colorArgs = this.state.isHDR ? "-pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 " : "";

    const resolvedOutputDir = this.state.getResolvedOutputDir() || "";
    const basePath = resolvedOutputDir ? `${resolvedOutputDir}/` : "";
    const outputName = this.state.outputFilename || this.state.getDefaultOutputFilename();
    const finalOutputPath = outputName.startsWith("/") 
      ? outputName 
      : `${basePath}${outputName}`;

    const codecConfig =
      CODEC_CONFIGS[this.state.codec] || CODEC_CONFIGS[DEFAULT_CODEC];
    const qualityArgs = `${codecConfig.qualityFlag} ${codecConfig.qualityValue}`;
    const presetArgs = codecConfig.preset ? ` -preset ${codecConfig.preset}` : "";
    const tagArgs = codecConfig.tag ? ` -tag:v ${codecConfig.tag}` : "";

    const isNetwork = filename.startsWith("http://") || filename.startsWith("https://") || this.state.isNetworkUrl();
    const tlsOption = (!this.state.tlsVerify && isNetwork) ? "-tls_verify 0 " : "";

    return `ffmpeg ${tlsOption}-ss ${this.state.timeArr[0]} -to ${this.state.timeArr[1]} -i ${escapedFilename} ${cropFilter}\n-c:v ${codecConfig.encoder} ${colorArgs}${qualityArgs}${presetArgs}${tagArgs} -c:a ${FFMPEG_DEFAULTS.audioCodec} -ac 2 -map_metadata -1 -map_chapters -1 -movflags +faststart ${finalOutputPath} && echo ${finalOutputPath}`;
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

    const windowWidth = this.state.frame.width;
    const windowHeight = this.state.frame.height;

    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (windowWidth > 0 && windowHeight > 0) {
      let videoAspect = this.state.dimensions.videoWidth / this.state.dimensions.videoHeight;
      try {
        const videoParams = mpv.getNative<Record<string, any>>("video-params");
        if (videoParams && videoParams.aspect && Number(videoParams.aspect) > 0) {
          videoAspect = Number(videoParams.aspect);
        }
      } catch {}

      const windowAspect = windowWidth / windowHeight;
      if (windowAspect > videoAspect) {
        // Pillarboxing: black bars on left and right
        const dispW = windowHeight * videoAspect;
        offsetX = (windowWidth - dispW) / 2;
        offsetY = 0;
        scale = this.state.dimensions.videoHeight / windowHeight;
      } else {
        // Letterboxing: black bars on top and bottom
        const dispH = windowWidth / videoAspect;
        offsetX = 0;
        offsetY = (windowHeight - dispH) / 2;
        scale = this.state.dimensions.videoWidth / windowWidth;
      }
    }

    this.state.scale = scale;
    this.state.offsetX = offsetX;
    this.state.offsetY = offsetY;



    try {
      const videoParams = mpv.getNative<Record<string, any>>("video-params") || {};
      const gamma = videoParams["gamma"] || mpv.getString("video-params/gamma");
      const sigPeak = videoParams["sig-peak"];
      
      this.state.isHDR = gamma === "smpte2084" || gamma === "pq" || gamma === "arib-std-b67" || gamma === "hlg" || (sigPeak && Number(sigPeak) > 1) ? true : false;
    } catch {
      this.state.isHDR = false;
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

    core.osd(
      `Crop set to: ${parsedCrop.width}:${parsedCrop.height}:${parsedCrop.x}:${parsedCrop.y}`,
    );
    return true;
  }


  async executeFFMPEG(ffmpegPath: string): Promise<void> {
    const commandResult = this.commandBuilder.buildCommand(true);
    if (
      !commandResult ||
      typeof commandResult === "string" ||
      !("args" in commandResult)
    )
      return;

    const { args, outputFilename } = commandResult;
    const cleanedArgs = args.filter((entry) => entry !== "");

    const inputFilename = this.state.getCurrentFilename();
    helpers.logger(`Processing ${inputFilename} -> ${outputFilename}`);

      try {
        const startSec = TimeUtils.isoToSeconds(this.state.timeArr[0]);
        const endSec = TimeUtils.isoToSeconds(this.state.timeArr[1]);
        const durationUs = (endSec - startSec) * 1_000_000;

        if (durationUs <= 0) {
          core.osd("Invalid duration. Please set valid start and end times.");
          sidebar.postMessage("ffmpeg-result", { message: "Error: Start and end times are the same.", error: true });
          return;
        }

        sidebar.postMessage("ffmpeg-progress", { progress: 0 });

        let lastOsdPct = -1;

        const result = await helpers.callFFMPEG(ffmpegPath, cleanedArgs, (timeUs) => {
          if (durationUs > 0) {
            let pct = (timeUs / durationUs) * 100;
            if (pct > 100) pct = 100;
            if (pct < 0) pct = 0;
            sidebar.postMessage("ffmpeg-progress", { progress: pct });

            const currentDecile = Math.floor(pct / 10) * 10;
            if (currentDecile > lastOsdPct) {
              core.osd(`Encoding Progress: ${currentDecile}%`);
              lastOsdPct = currentDecile;
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

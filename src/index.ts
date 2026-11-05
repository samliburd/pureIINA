import { AppState, VideoProcessor } from "./core";
import { TimeUtils, UserPrompts, CoordinateUtils } from "./utils";
import { IPCUpdateMessage, IPCCropUpdateMessage, IPCTimeUpdateMessage, IPCSyncStateMessage, IPCSetFilenameMessage, IPCSetCropStringMessage, VideoTrackInfo, IPCSetFFMPEGPathMessage, IPCSetCodecMessage, VideoCodec, IPCSetTLSVerifyMessage } from "./types";
import { findFFMPEGPath, setFFMPEGPath, downloadFFMPEG, unzip } from "./helpers";

const { core, event, utils, file, console, sidebar, mpv, overlay, preferences } = iina;


// Initialize Core Logic
const appState = new AppState();
const savedCodec = preferences.get("codec") || preferences.get("video_codec");
if (savedCodec && ["x264", "x265", "h264_videotoolbox", "hevc_videotoolbox"].includes(savedCodec)) {
    appState.codec = savedCodec as VideoCodec;
}
const videoProcessor = new VideoProcessor(appState);

let currentFFMPEGPath: string | null = null;

// Event listeners removed as requested

function getVideoTrackInfo(): VideoTrackInfo | null {
    try {
        if (!core.status.videoWidth || core.status.idle) {
            return null;
        }

        const currentTrack = core.video.currentTrack;
        const videoParams = mpv.getNative<Record<string, any>>("video-params") || {};

        const codec = currentTrack?.codec || mpv.getString("video-codec") || mpv.getString("video-format") || undefined;
        const pixelFormat = videoParams["pixelformat"] || mpv.getString("video-params/pixelformat") || undefined;
        const colormatrix = videoParams["colormatrix"] || mpv.getString("video-params/colormatrix") || undefined;
        const primaries = videoParams["primaries"] || mpv.getString("video-params/primaries") || undefined;
        const gamma = videoParams["gamma"] || mpv.getString("video-params/gamma") || undefined;
        const colorlevels = videoParams["colorlevels"] || mpv.getString("video-params/colorlevels") || undefined;
        const bitDepth = videoParams["plane-depth"] || (videoParams["average-bpp"] ? Math.round(Number(videoParams["average-bpp"]) / 3) : undefined);

        const fps = mpv.getNumber("container-fps") || currentTrack?.demuxFPS || mpv.getNumber("estimated-vf-fps") || undefined;
        const bitrate = mpv.getNumber("video-bitrate") || undefined;
        const hwdec = mpv.getString("hwdec-current") || undefined;

        // Detect HDR
        let hdr: string | undefined = undefined;
        if (gamma === "smpte2084" || gamma === "pq") {
            hdr = "HDR10 (PQ)";
        } else if (gamma === "arib-std-b67" || gamma === "hlg") {
            hdr = "HLG";
        } else if (videoParams["sig-peak"] && Number(videoParams["sig-peak"]) > 1) {
            hdr = "HDR";
        }

        return {
            trackTitle: (currentTrack as any)?.formattedTitle || (currentTrack as any)?.formattedTitie || currentTrack?.title || undefined,
            codec: codec ? codec.toUpperCase() : undefined,
            pixelFormat,
            colorSpace: colormatrix,
            primaries,
            gamma,
            colorLevels: colorlevels,
            bitDepth: bitDepth ? Number(bitDepth) : undefined,
            fps: fps && fps > 0 ? Math.round(fps * 100) / 100 : undefined,
            bitrate: bitrate && bitrate > 0 ? bitrate : undefined,
            hwdec: hwdec && hwdec !== "no" ? hwdec : undefined,
            hdr,
        };
    } catch {
        return null;
    }
}

function broadcastVideoState(): void {
    videoProcessor.updateVideoVariables();

    const payload: IPCUpdateMessage = {
        videoFrame: core.window.frame,
        videoWidth: core.status.videoWidth || 0,
        videoHeight: core.status.videoHeight || 0,
        scale: appState.scale || 1,
        offsetX: appState.offsetX || 0,
        offsetY: appState.offsetY || 0,
        showHud: appState.showHud,
        videoTrack: getVideoTrackInfo(),
        isPaused: core.status.paused,
        inputFileUrl: appState.getInputUrl()
    };
    
    sidebar.postMessage("video-update", payload);
    overlay.postMessage("video-update", payload);
    
    sendCropState();
}

function sendCropState(): void {
    const payload: IPCCropUpdateMessage = {
        cropBox: appState.normalizedCoordinates,
    };

    sidebar.postMessage("crop-update", payload);
    overlay.postMessage("crop-update", payload);

    if (appState.useCrop || appState.showHud) {
        overlay.show();
    } else {
        overlay.hide();
    }
}

event.on("iina.window-loaded", () => {
    sidebar.loadFile("dist/ui/sidebar/index.html");
    overlay.loadFile("dist/ui/overlay/index.html");
    overlay.simpleMode();
    
    findFFMPEGPath().then((path) => {
        if (path) {
            currentFFMPEGPath = path;
            sidebar.postMessage("ffmpeg-path-update", { path: currentFFMPEGPath });
        }
    });

    event.on("iina.file-loaded", () => {
        const duration = appState.getFormattedDuration();
        appState.endTime = duration;
        appState.timeArr[1] = duration;
        appState.tlsVerify = true;

        // Respect default crop mode preference
        const defaultCrop = preferences.get("crop_mode_default");
        if (defaultCrop !== undefined && defaultCrop !== null) {
            appState.useCrop = Boolean(defaultCrop);
            appState.showHud = Boolean(defaultCrop);
        }

        const payload: IPCTimeUpdateMessage = { type: "end", time: duration };
        sidebar.postMessage("time-update", payload);
        broadcastVideoState();
    });

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
            showHud: appState.showHud,
            ffmpegPath: currentFFMPEGPath,
            isPaused: core.status.paused,
            codec: appState.codec,
            inputFileUrl: appState.getInputUrl(),
            tlsVerify: appState.tlsVerify,
        };
        sidebar.postMessage("sync-state", payload);
    });

    sidebar.onMessage("set-tls-verify", (data: IPCSetTLSVerifyMessage) => {
        appState.tlsVerify = Boolean(data.tlsVerify);
        broadcastCommand();
    });

    sidebar.onMessage("set-filename", (data: IPCSetFilenameMessage) => {
        appState.outputFilename = data.filename;
        broadcastCommand();
    });

    sidebar.onMessage("set-codec", (data: IPCSetCodecMessage) => {
        if (data.codec) {
            appState.codec = data.codec;
            preferences.set("codec", data.codec);
            preferences.set("video_codec", data.codec);
            broadcastCommand();
        }
    });

    sidebar.onMessage("set-ffmpeg-path", (data: IPCSetFFMPEGPathMessage) => {
        const success = setFFMPEGPath(data.path);
        if (success) {
            currentFFMPEGPath = data.path;
            core.osd(`FFMPEG Path set successfully`);
        } else {
            core.osd(`Invalid FFMPEG path`);
        }
        sidebar.postMessage("ffmpeg-path-update", { path: currentFFMPEGPath });
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
        broadcastVideoState();
        broadcastCommand();
    });

    sidebar.onMessage("set-crop-string", (data: IPCSetCropStringMessage) => {
        if (videoProcessor.setCropFromString(data.cropString)) {
            sendCropState();
            broadcastCommand();
        }
    });

    sidebar.onMessage("get-command", () => {
        broadcastCommand();
    });

    sidebar.onMessage("run-ffmpeg", () => {
        if (!currentFFMPEGPath) {
            core.osd("FFmpeg not found! Please set the path first.");
            return;
        }
        void videoProcessor.executeFFMPEG(currentFFMPEGPath);
    });

    sidebar.onMessage("test-find-ffmpeg", async () => {
        try {
            const dataBinPath = utils.resolvePath("@data/bin");
            const { status, stdout } = await utils.exec("/bin/bash", [
                "-ilc",
                `export PATH=$PATH:$HOME/.local/bin:$HOME/miniconda3/envs/default/bin:/opt/homebrew/bin:/usr/local/bin:/opt/local/bin:"${dataBinPath}" && which -a ffmpeg`
            ]);
            
            if (status === 0 && stdout) {
                // Split by newline and filter out any empty strings
                const paths = stdout.split("\n").filter(p => p.trim().length > 0);
                
                // Remove duplicates by using Set
                const uniquePaths = Array.from(new Set(paths));
                
                sidebar.postMessage("ffmpeg-paths-found", { paths: uniquePaths });
            } else {
                sidebar.postMessage("ffmpeg-paths-found", { paths: [] });
            }
        } catch (error) {
            core.osd(`Error finding FFmpeg: ${error}`);
        }
    });

    sidebar.onMessage("download-ffmpeg", async () => {
        sidebar.postMessage("ffmpeg-download-progress", { status: "Downloading FFmpeg (this may take a minute)..." });
        
        const downloaded = await downloadFFMPEG();
        if (downloaded === true) {
            sidebar.postMessage("ffmpeg-download-progress", { status: "Extracting FFmpeg..." });
            
            const unzipStatus = await unzip();
            if (unzipStatus === 0) {
                const binaryPath = utils.resolvePath("@data/bin/ffmpeg");
                // Ensure executable permissions
                await utils.exec("/bin/chmod", ["+x", binaryPath]);
                
                const success = setFFMPEGPath(binaryPath);
                if (success) {
                    currentFFMPEGPath = binaryPath;
                    sidebar.postMessage("ffmpeg-download-progress", { status: "FFmpeg downloaded and installed successfully!" });
                    sidebar.postMessage("ffmpeg-path-update", { path: binaryPath });
                    return;
                }
            }
        }
        
        sidebar.postMessage("ffmpeg-download-progress", { status: "Failed to download or install FFmpeg." });
    });

    event.on("iina.window-resized", broadcastVideoState);
    event.on("iina.window-moved", broadcastVideoState);
    event.on("iina.window-size-adjusted", broadcastVideoState);
    event.on("iina.window-fs.changed", broadcastVideoState);
    
    // MPV properties mapped to IINA events
    event.on("mpv.pause.changed", broadcastVideoState);
});

import { AppState, VideoProcessor } from "./core";
import { TimeUtils, UserPrompts, CoordinateUtils } from "./utils";
import { IPCUpdateMessage, IPCClickMessage, IPCTimeUpdateMessage, IPCSyncStateMessage, IPCSetFilenameMessage, IPCSetCropStringMessage, VideoTrackInfo, IPCSetFFMPEGPathMessage } from "./types";
import { findFFMPEGPath, setFFMPEGPath, downloadFFMPEG, unzip } from "./helpers";

const { core, event, utils, file, console, sidebar, mpv } = iina;
const input = (iina as any).input;

// Initialize Core Logic
const appState = new AppState();
const videoProcessor = new VideoProcessor(appState);

let currentFFMPEGPath: string | null = null;

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
}

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

function startIntervals(): void {
    setInterval(() => {
        const payload: IPCUpdateMessage = {
            time: TimeUtils.secondsToISO(core.status.position || 0),
            videoFrame: core.window.frame,
            videoWidth: core.status.videoWidth || 0,
            videoHeight: core.status.videoHeight || 0,
            scale: appState.scale || 1,
            showHud: appState.showHud,
            videoTrack: getVideoTrackInfo()
        };
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

    sidebar.postMessage("click-update", payload);
}

event.on("iina.window-loaded", () => {
    sidebar.loadFile("dist/ui/sidebar/index.html");
    
    findFFMPEGPath().then((path) => {
        if (path) {
            currentFFMPEGPath = path;
            sidebar.postMessage("ffmpeg-path-update", { path: currentFFMPEGPath });
        }
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
            ffmpegPath: currentFFMPEGPath
        };
        sidebar.postMessage("sync-state", payload);
    });

    sidebar.onMessage("set-filename", (data: IPCSetFilenameMessage) => {
        appState.outputFilename = data.filename;
        broadcastCommand();
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
        sendClickState();
        broadcastCommand();
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
        if (!currentFFMPEGPath) {
            core.osd("FFmpeg not found! Please set the path first.");
            return;
        }
        void videoProcessor.executeFFMPEG(currentFFMPEGPath, true);
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

    setupEventListeners();
    startIntervals();
});

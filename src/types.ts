export type VideoCodec =
    | "x264"
    | "x265"
    | "h264_videotoolbox"
    | "hevc_videotoolbox";

export interface Point {
    x: number;
    y: number;
}

export interface Dimensions {
    videoWidth: number;
    videoHeight: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface VideoTrackInfo {
    trackTitle?: string;
    codec?: string;
    pixelFormat?: string;
    colorSpace?: string;
    primaries?: string;
    gamma?: string;
    colorLevels?: string;
    bitDepth?: number;
    fps?: number;
    bitrate?: number;
    hwdec?: string;
    hdr?: string;
}

export interface IPCUpdateMessage {
    videoFrame: Rect;
    videoWidth: number;
    videoHeight: number;
    scale: number;
    offsetX?: number;
    offsetY?: number;
    showHud: boolean;
    videoTrack?: VideoTrackInfo | null;
    isPaused: boolean;
    inputFileUrl?: string;
}

export interface IPCCropUpdateMessage {
    cropBox: Rect | null;
}

export interface FFMPEGCommandResult {
    args: string[];
    outputFilename: string;
}

export interface IPCTimeUpdateMessage {
    type: "start" | "end";
    time: string;
}

export interface IPCSyncStateMessage {
    startTime: string;
    endTime: string;
    filename: string;
    useCrop: boolean;
    cropString: string;
    showHud: boolean;
    ffmpegPath: string | null;
    isPaused: boolean;
    codec: VideoCodec;
    inputFileUrl?: string;
    tlsVerify?: boolean;
}

export interface IPCSetTLSVerifyMessage {
    tlsVerify: boolean;
}

export interface IPCSetCodecMessage {
    codec: VideoCodec;
}

export interface IPCSetFilenameMessage {
    filename: string;
}

export interface IPCSetFFMPEGPathMessage {
    path: string;
}

export interface IPCSetCropStringMessage {
    cropString: string;
}

export interface IPCCommandResultMessage {
    command: string;
}

export interface IPCFFMPEGProgressMessage {
    progress: number | null;
}

export interface IPCFFMPEGResultMessage {
    message: string;
    error: boolean;
}

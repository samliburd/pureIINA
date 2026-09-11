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

export interface IPCUpdateMessage {
    time: string;
    videoFrame: Rect;
    videoWidth: number;
    videoHeight: number;
    scale: number;
}

export interface IPCClickMessage {
    firstClick: Point;
    secondClick: Point;
    normFirstClick: Point;
    normSecondClick: Point;
    cropBox: Rect | null;
    isWaiting: boolean;
}

export interface FFMPEGCommandResult {
    args: string[];
    outputFilename: string;
}

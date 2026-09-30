import React, { useState, useEffect } from "react";
import { IPCUpdateMessage, IPCClickMessage } from "../../src/types";

const App: React.FC = () => {
    const [videoFrame, setVideoFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
    const [videoScale, setVideoScale] = useState<number>(1);
    const [cropBox, setCropBox] = useState<{ width: number; height: number; x: number; y: number } | null>(null);

    useEffect(() => {
        if (window.iina) {
            window.iina.onMessage("video-update", (data: IPCUpdateMessage & { videoWidth?: number, videoHeight?: number }) => {
                if (data.videoFrame) setVideoFrame(data.videoFrame);
                if (data.scale !== undefined) setVideoScale(data.scale);
                if (data.videoWidth && data.videoHeight) setVideoDimensions({ width: data.videoWidth, height: data.videoHeight });
            });

            window.iina.onMessage("click", (data: IPCClickMessage) => {
                setCropBox(data.cropBox);
            });
        }
    }, []);

    const getBoxStyles = (): React.CSSProperties => {
        if (!cropBox || cropBox.width === 0 || cropBox.height === 0 || !videoFrame) {
            return { display: "none" };
        }

        const safeScale = videoScale || 1;
        
        // The IINA overlay webview is natively bound to the video frame size,
        // so we DO NOT add videoFrame.x or videoFrame.y here.
        const left = (cropBox.x / safeScale);
        const top = (cropBox.y / safeScale);
        const width = cropBox.width / safeScale;
        const height = cropBox.height / safeScale;

        return {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
            position: "absolute" as const,
            border: "2px solid #ff4081",
            backgroundColor: "rgba(255, 64, 129, 0.2)",
            pointerEvents: "none",
            zIndex: 9999,
        };
    };

    return (
        <div>
            <div id="cropBox" style={getBoxStyles()}></div>
        </div>
    );
};

export default App;

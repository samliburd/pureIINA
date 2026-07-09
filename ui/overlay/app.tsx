import "../shared.scss";
import React, { useState, useEffect } from "react";

const App = () => {
    const [currentTime, setCurrentTime] = useState("00:00:00.000");
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [videoFrame, setVideoFrame] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const [videoScale, setVideoScale] = useState(1);

    const [firstClick, setFirstClick] = useState({ x: 0, y: 0 });
    const [secondClick, setSecondClick] = useState({ x: 0, y: 0 });

    const [normFirstClick, setNormFirstClick] = useState({ x: 0, y: 0 });
    const [normSecondClick, setNormSecondClick] = useState({ x: 0, y: 0 });
    const [cropBox, setCropBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        if (window.iina) {
            window.iina.onMessage("update", (data: any) => {
                setCurrentTime(data.time);
                setVideoFrame(data.videoFrame);

                if (data.scale !== undefined) {
                    setVideoScale(data.scale);
                }

                if (data.videoWidth > 0 && data.videoHeight > 0) {
                    setDimensions((prev) => {
                        if (
                            prev.width !== data.videoWidth ||
                            prev.height !== data.videoHeight
                        ) {
                            return { width: data.videoWidth, height: data.videoHeight };
                        }
                        return prev;
                    });
                }
            });

            window.iina.onMessage("click", (data: any) => {
                setFirstClick(data.firstClick);
                setSecondClick(data.secondClick);
                setNormFirstClick(data.normFirstClick);
                setNormSecondClick(data.normSecondClick);
                setCropBox(data.cropBox);
                setIsWaiting(data.isWaiting);
            });
        }
    }, []);

    const getBoxStyles = (): React.CSSProperties => {
        if (
            normFirstClick.x === 0 &&
            normFirstClick.y === 0 &&
            normSecondClick.x === 0 &&
            normSecondClick.y === 0
        ) {
            return { display: "none" };
        }

        const safeScale = videoScale || 1;
        const currentFirstX = normFirstClick.x / safeScale;
        const currentFirstY = normFirstClick.y / safeScale;
        const currentSecondX = normSecondClick.x / safeScale;
        const currentSecondY = normSecondClick.y / safeScale;

        if (isWaiting) {
            return {
                left: `${currentFirstX - 3}px`,
                top: `${currentFirstY - 3}px`,
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 105, 180, 0.8)",
                border: "none",
                position: "absolute" as const,
            };
        }

        const left = Math.min(currentFirstX, currentSecondX);
        const top = Math.min(currentFirstY, currentSecondY);
        const width = Math.abs(currentFirstX - currentSecondX);
        const height = Math.abs(currentFirstY - currentSecondY);

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
            {/* The visual crop rectangle */}
            <div id="cropBox" style={getBoxStyles()}></div>

            <div className="hud-container">
                {/* 1. Global Video Stats */}
                <div className="hud-panel flex-row">
                    <div className="stat-item">
                        <span className="stat-label">Time:</span>
                        <span className="stat-value">{currentTime}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Res:</span>
                        <span className="stat-value">{dimensions.width}x{dimensions.height}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Scale:</span>
                        <span className="stat-value">{videoScale.toFixed(2)}</span>
                    </div>
                </div>

                {/* 2. Window Frame Stats */}
                <div className="hud-panel flex-row">
                    <div className="stat-item">
                        <span className="stat-label">Frame:</span>
                        <span className="stat-value">
                            {videoFrame ? `x:${videoFrame.x} y:${videoFrame.y} w:${videoFrame.width} h:${videoFrame.height}` : "{}"}
                        </span>
                    </div>
                    <div className="stat-item" style={{ marginLeft: "auto" }}>
                        <span className="stat-label">Status:</span>
                        <span className="status-indicator">
                            {isWaiting ? "Waiting for 2nd click..." : "Ready"}
                        </span>
                    </div>
                </div>

                {/* 3. Coordinates Comparison */}
                <div className="hud-panel flex-row">
                    <div className="flex-col">
                        <h4>Raw (Frame)</h4>
                        <div className="stat-item">
                            <span className="stat-label">P1:</span>
                            <span className="stat-value">{firstClick.x}, {firstClick.y}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">P2:</span>
                            <span className="stat-value">{secondClick.x}, {secondClick.y}</span>
                        </div>
                    </div>
                    <div className="flex-col">
                        <h4>Normalized (Video)</h4>
                        <div className="stat-item">
                            <span className="stat-label">P1:</span>
                            <span className="stat-value">{normFirstClick.x}, {normFirstClick.y}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">P2:</span>
                            <span className="stat-value">{normSecondClick.x}, {normSecondClick.y}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Final Crop Box Summary */}
                {cropBox && !isWaiting && (
                    <div className="hud-panel">
                        <h4>Final Crop Box</h4>
                        <div className="flex-row">
                            <div className="stat-item"><span className="stat-label">W:</span><span className="stat-value">{cropBox.width}</span></div>
                            <div className="stat-item"><span className="stat-label">H:</span><span className="stat-value">{cropBox.height}</span></div>
                            <div className="stat-item"><span className="stat-label">X:</span><span className="stat-value">{cropBox.x}</span></div>
                            <div className="stat-item"><span className="stat-label">Y:</span><span className="stat-value">{cropBox.y}</span></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;

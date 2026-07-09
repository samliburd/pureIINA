import "../shared.scss"
import React, { useState, useEffect } from "react";

const App = () => {
    const [currentTime, setCurrentTime] = useState("00:00:00.000");
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [videoFrame, setVideoFrame] = useState(null);
    const [videoScale, setVideoScale] = useState(1);

    const [firstClick, setFirstClick] = useState({ x: 0, y: 0 });
    const [secondClick, setSecondClick] = useState({ x: 0, y: 0 });

    const [normFirstClick, setNormFirstClick] = useState({ x: 0, y: 0 });
    const [normSecondClick, setNormSecondClick] = useState({ x: 0, y: 0 });
    const [cropBox, setCropBox] = useState(null);

    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        if (window.iina) {
            window.iina.onMessage("update", (data) => {
                setCurrentTime(data.time);
                setVideoFrame(data.videoFrame);

                // <-- Added scale listener here
                if (data.scale !== undefined) {
                    setVideoScale(data.scale);
                }

                if (data.videoWidth > 0 && data.videoHeight > 0) {
                    setDimensions(prev => {
                        if (prev.width !== data.videoWidth || prev.height !== data.videoHeight) {
                            return { width: data.videoWidth, height: data.videoHeight };
                        }
                        return prev;
                    });
                }
            });

            window.iina.onMessage("click", (data) => {
                setFirstClick(data.firstClick);
                setSecondClick(data.secondClick);
                setNormFirstClick(data.normFirstClick);
                setNormSecondClick(data.normSecondClick);
                setCropBox(data.cropBox);
                setIsWaiting(data.isWaiting);
            });
        }
    }, []);

    // --- Dynamic CSS Calculation ---
    const getBoxStyles = () => {
        // Hide the box entirely if no clicks have been registered (or if reset)
        if (firstClick.x === 0 && firstClick.y === 0 && secondClick.x === 0 && secondClick.y === 0) {
            return { display: "none" };
        }

        // If waiting for the second click, just draw a small dot at the first click position
        if (isWaiting) {
            return {
                left: `${firstClick.x - 3}px`,
                top: `${firstClick.y - 3}px`,
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "rgba(255, 105, 180, 0.8)",
                border: "none"
            };
        }

        // If both clicks are present, calculate the full rectangle
        const left = Math.min(firstClick.x, secondClick.x);
        const top = Math.min(firstClick.y, secondClick.y);
        const width = Math.abs(firstClick.x - secondClick.x);
        const height = Math.abs(firstClick.y - secondClick.y);

        return {
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`
        };
    };

    return (
        <div>
            {/* The visual crop rectangle */}
            <div id="cropBox" style={getBoxStyles()}></div>

            <h1>Hello!</h1>
            <p>This is a video overlay.</p>
            <p>Current Time: {currentTime}</p>
            <p>Video dimensions: {dimensions.width}x{dimensions.height}</p>
            <p>Player frame: {JSON.stringify(videoFrame)}</p>
            <p>Scale: {videoScale}</p>

            <hr />
            <p>Status: {isWaiting ? "Waiting for second click..." : "Ready to crop"}</p>

            <h3>Raw Coordinates (Frame)</h3>
            <p>First click: {firstClick.x}, {firstClick.y}</p>
            <p>Second click: {secondClick.x}, {secondClick.y}</p>

            <h3>Normalized Coordinates (Video Resolution)</h3>
            <p>First click: {normFirstClick.x}, {normFirstClick.y}</p>
            <p>Second click: {normSecondClick.x}, {normSecondClick.y}</p>

            {cropBox && !isWaiting && (
                <div>
                    <h3>Final Crop Box</h3>
                    <p>Width: {cropBox.width}, Height: {cropBox.height}</p>
                    <p>Offset X: {cropBox.x}, Offset Y: {cropBox.y}</p>
                </div>
            )}
        </div>
    );
};

export default App;

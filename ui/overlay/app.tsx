import "../shared.scss";
import React, {useState, useEffect} from "react";

const App = () => {
    const [currentTime, setCurrentTime] = useState("00:00:00.000");
    const [dimensions, setDimensions] = useState({width: 0, height: 0});
    const [videoFrame, setVideoFrame] = useState(null);
    const [videoScale, setVideoScale] = useState(1);

    const [firstClick, setFirstClick] = useState({x: 0, y: 0});
    const [secondClick, setSecondClick] = useState({x: 0, y: 0});

    const [normFirstClick, setNormFirstClick] = useState({x: 0, y: 0});
    const [normSecondClick, setNormSecondClick] = useState({x: 0, y: 0});
    const [cropBox, setCropBox] = useState(null);

    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        if (window.iina) {
            // TypeScript now knows exactly what 'data' is!
            window.iina.onMessage("update", (data) => {
                setCurrentTime(data.time);
                setVideoFrame(data.videoFrame as any);

                if (data.scale !== undefined) {
                    setVideoScale(data.scale);
                }

                if (data.videoWidth > 0 && data.videoHeight > 0) {
                    setDimensions((prev) => {
                        if (
                            prev.width !== data.videoWidth ||
                            prev.height !== data.videoHeight
                        ) {
                            return {width: data.videoWidth, height: data.videoHeight};
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
                setCropBox(data.cropBox as any);
                setIsWaiting(data.isWaiting);
            });
        }
    }, []);

    // --- Dynamic CSS Calculation ---
    // --- Dynamic CSS Calculation ---
    // --- Dynamic CSS Calculation ---
    const getBoxStyles = (): React.CSSProperties => {
        // Hide the box entirely if no clicks have been registered (or if reset)
        // Check normalized clicks to ensure we have valid data
        if (
            normFirstClick.x === 0 &&
            normFirstClick.y === 0 &&
            normSecondClick.x === 0 &&
            normSecondClick.y === 0
        ) {
            return {display: "none"};
        }

        // Prevent division by zero as a safety net
        const safeScale = videoScale || 1;

        // Convert the backend's normalized video coordinates BACK to current window pixels
        // Because your backend did: normX = rawX * scale
        // We do: currentDisplayX = normX / currentLiveScale
        const currentFirstX = normFirstClick.x / safeScale;
        const currentFirstY = normFirstClick.y / safeScale;
        const currentSecondX = normSecondClick.x / safeScale;
        const currentSecondY = normSecondClick.y / safeScale;

        // If waiting for the second click, just draw a small dot at the calculated position
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

        // If both clicks are present, calculate the full rectangle using the live mapped coordinates
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

            <h1>Hello!</h1>
            <p>This is a video overlay.</p>
            <p>Current Time: {currentTime}</p>
            <p>
                Video dimensions: {dimensions.width}x{dimensions.height}
            </p>
            <p>Player frame: {JSON.stringify(videoFrame)}</p>
            <p>Scale: {videoScale}</p>

            <hr/>
            <p>
                Status: {isWaiting ? "Waiting for second click..." : "Ready to crop"}
            </p>

            <h3>Raw Coordinates (Frame)</h3>
            <p>
                First click: {firstClick.x}, {firstClick.y}
            </p>
            <p>
                Second click: {secondClick.x}, {secondClick.y}
            </p>

            <h3>Normalized Coordinates (Video Resolution)</h3>
            <p>
                First click: {normFirstClick.x}, {normFirstClick.y}
            </p>
            <p>
                Second click: {normSecondClick.x}, {normSecondClick.y}
            </p>

            {cropBox && !isWaiting && (
                <div>
                    <h3>Final Crop Box</h3>
                    <p>
                        Width: {cropBox.width}, Height: {cropBox.height}
                    </p>
                    <p>
                        Offset X: {cropBox.x}, Offset Y: {cropBox.y}
                    </p>
                </div>
            )}
        </div>
    );
};

export default App;

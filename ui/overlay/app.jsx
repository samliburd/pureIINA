import React, { useState, useEffect } from "react";

const App = () => {
    const [currentTime, setCurrentTime] = useState("00:00:00.000");
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Initialize both clicks as objects instead of 0
    const [firstClick, setFirstClick] = useState({ x: 0, y: 0 });
    const [secondClick, setSecondClick] = useState({ x: 0, y: 0 });
    const [isWaiting, setIsWaiting] = useState(false);

    useEffect(() => {
        if (window.iina) {
            window.iina.onMessage("update", (data) => {
                setCurrentTime(data.time);

                if (data.videoWidth > 0 && data.videoHeight > 0) {
                    setDimensions(prev => {
                        if (prev.width !== data.videoWidth || prev.height !== data.videoHeight) {
                            return { width: data.videoWidth, height: data.videoHeight };
                        }
                        return prev;
                    });
                }
            });

            // Catch the bundled click payload
            window.iina.onMessage("click", (data) => {
                setFirstClick(data.firstClick);
                setSecondClick(data.secondClick);
                setIsWaiting(data.isWaiting);
            });
        }
    }, []);

    return (
        <div>
            <h1>Hello!</h1>
            <p>This is a video overlay.</p>
            <p>Current Time: {currentTime}</p>
            <p>Video dimensions: {dimensions.width}x{dimensions.height}</p>

            <hr />
            <p>Status: {isWaiting ? "Waiting for second click..." : "Ready to crop"}</p>
            <p>First click pos: {firstClick.x}, {firstClick.y}</p>
            <p>Second click pos: {secondClick.x}, {secondClick.y}</p>
        </div>
    );
};

export default App;

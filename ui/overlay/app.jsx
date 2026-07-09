import React, { useState, useEffect } from "react";

const App = () => {
    const [currentTime, setCurrentTime] = useState("00:00:00.000");
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
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
        }
    }, []);


    return (
        <div>
            <h1>Hello!</h1>
            <p>This is a video overlay.</p>
            <p>Current Time: {currentTime}</p>
            <p>Video dimensions: {dimensions.width}x{dimensions.height}</p>
        </div>
    );
};

export default App;

import React, { useState, useEffect } from "react";

const App = () => {
  const [videoInfo, setVideoInfo] = useState({
    filename: "Loading...",
    duration: "00:00:00.000",
    dimensions: { videoWidth: 0, videoHeight: 0 },
  });

  useEffect(() => {
    // Listen for messages from the main plugin process (src/index.js)
    if (window.iina) {
      window.iina.onMessage("update-video-info", (data) => {
        setVideoInfo(data);
      });
    }

    // Example of sending a message back to the main process
    // window.iina.postMessage('overlay-ready', { status: 'ready' });
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "20px",
        padding: "15px",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        borderRadius: "8px",
        backdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: "250px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "16px",
          fontWeight: "600",
          color: "#fff",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          paddingBottom: "8px",
        }}
      >
        pureIINA React Overlay
      </h3>

      <div style={{ fontSize: "14px", color: "#eee" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span style={{ color: "#aaa" }}>File:</span>
          <span
            style={{
              fontWeight: "500",
              maxWidth: "180px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {videoInfo.filename}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span style={{ color: "#aaa" }}>Duration:</span>
          <span style={{ fontFamily: "monospace" }}>{videoInfo.duration}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#aaa" }}>Dimensions:</span>
          <span style={{ fontFamily: "monospace" }}>
            {videoInfo.dimensions.videoWidth} x{" "}
            {videoInfo.dimensions.videoHeight}
          </span>
        </div>
      </div>
    </div>
  );
};

export default App;

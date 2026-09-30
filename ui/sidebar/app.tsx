import React, { useState, useEffect } from "react";

const App = () => {
  const [startTime, setStartTime] = useState("--:--:--");
  const [endTime, setEndTime] = useState("--:--:--");

  useEffect(() => {
    if (window.iina) {
      window.iina.onMessage("update-start-time", (data: any) => {
        setStartTime(data.time);
      });
      window.iina.onMessage("update-end-time", (data: any) => {
        setEndTime(data.time);
      });
    }
  }, []);

  const handleSetStartTime = () => {
    if (window.iina) {
      window.iina.postMessage("set-start-time", {});
    } else {
      alert("window.iina is not defined!");
    }
  };

  const handleSetEndTime = () => {
    if (window.iina) {
      window.iina.postMessage("set-end-time", {});
    } else {
      alert("window.iina is not defined!");
    }
  };

  return (
    <div>
      <p style={{ padding: '0 16px', margin: '16px 0 0 0' }}>This is a sidebar view.</p>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', padding: '16px' }}>
        <button onClick={handleSetStartTime} style={{ flex: 1 }}>Set Start Time</button>
        <button onClick={handleSetEndTime} style={{ flex: 1 }}>Set End Time</button>
      </div>
      <div style={{ padding: '0 16px' }}>
        <p>Start time: <strong>{startTime}</strong></p>
        <p>End time: <strong>{endTime}</strong></p>
      </div>
    </div>
  );
};

export default App;
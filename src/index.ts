const {
  overlay,
  sidebar,
  event: iinaEvent,
  console: iinaConsole,
  menu,
  core
} = iina;

iinaConsole.log("Plugin is running");

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const fractional = (seconds % 1).toFixed(3).substring(2);
  
  const pad = (num: number) => num.toString().padStart(2, "0");
  
  if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}.${fractional}`;
  }
  return `${pad(m)}:${pad(s)}.${fractional}`;
}

iinaEvent.on("iina.window-loaded", () => {
  overlay.loadFile("dist/ui/overlay/index.html");
  sidebar.loadFile("dist/ui/sidebar/index.html");

  sidebar.onMessage("set-start-time", () => {
    iinaConsole.log("Received set-start-time from sidebar");
    const currentPos = core.status.position || 0;
    const startTime = formatTime(currentPos);
    sidebar.postMessage("update-start-time", { time: startTime });
  });

  sidebar.onMessage("set-end-time", () => {
    iinaConsole.log("Received set-end-time from sidebar");
    const currentPos = core.status.position || 0;
    const endTime = formatTime(currentPos);
    sidebar.postMessage("update-end-time", { time: endTime });
  });
});
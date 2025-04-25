const { standaloneWindow, overlay, console, menu, core, input, utils } = iina;

// Initialize overlay
overlay.loadFile("dist/ui/overlay/index.html");
overlay.setClickable(true);

// Global variables
let dimensions, frame, scale, rectangleCoordinates, normalizedCoordinates;
let firstClickPos = { x: 0, y: 0 };
let secondClickPos = { x: 0, y: 0 };
let isWaitingForSecondClick = false;
let isHidden = true;
let timeArr = [];
let outputFilename = ""; // Store the output filename globally
let useCrop = false;
let startTime = "00:00:00.000",
  endTime = "00:00:00.000";
const regex = /\s/g;
const filename = core.status.url.replace("file://", "").replace(regex, "\\ ");

// Helper functions
function getRectangleCoordinates(firstClick, secondClick) {
  const x1 = firstClick.x;
  const y1 = firstClick.y;
  const x2 = secondClick.x;
  const y2 = secondClick.y;

  return {
    x: Math.round(Math.min(x1, x2)),
    y: Math.round(Math.min(y1, y2)),
    width: Math.round(Math.abs(x2 - x1)),
    height: Math.round(Math.abs(y2 - y1)),
  };
}

function getNormalizedCoordinates(coordinates, scale) {
  return {
    x: Math.round(coordinates.x * scale),
    y: Math.round(coordinates.y * scale),
    width: Math.round(coordinates.width * scale),
    height: Math.round(coordinates.height * scale),
  };
}

function formatDecimals(objArray, round = false) {
  objArray.forEach((obj) => {
    if (!round) {
      Object.keys(obj).forEach((key) => {
        obj[key] = Number(obj[key]).toFixed(2);
      });
    } else {
      Object.keys(obj).forEach((key) => {
        obj[key] = Number(Math.round(obj[key]));
      });
    }
  });
}

function updateClickPos(x, y) {
  if (!isWaitingForSecondClick) {
    // First click
    firstClickPos = { x, y };
  } else {
    // Second click
    secondClickPos = { x, y };
    isWaitingForSecondClick = false;
  }
}

function updateVariables() {
  dimensions = {
    videoWidth: core.status.videoWidth,
    videoHeight: core.status.videoHeight,
  };
  frame = core.window.frame;
  scale = dimensions.videoWidth / frame.width;
  rectangleCoordinates = getRectangleCoordinates(firstClickPos, secondClickPos);
  normalizedCoordinates = getNormalizedCoordinates(rectangleCoordinates, scale);
}

function postUpdate() {
  overlay.postMessage("update", {
    dimensions: dimensions,
    windowSize: frame,
    firstClick: firstClickPos,
    secondClick: secondClickPos,
    rectangleCoordinates: rectangleCoordinates,
    normalizedCoordinates: normalizedCoordinates,
    isHidden: isHidden,
  });
}

function getTimePos(index) {
  const timePos = core.status.position;
  timeArr[index] = new Date(timePos * 1000).toISOString().substring(11, 23);
  return timeArr[index];
}

function promptOutputFilename() {
  const fn = utils.prompt(`Please enter the file name\n\n${filename}`);
  outputFilename = `${fn}.mp4`;
  return outputFilename;
}

function toggleCrop() {
  useCrop = !useCrop;
  core.osd(`Crop ${useCrop ? "enabled" : "disabled"}`);
}

async function copyToClipboard() {
  // Ensure timeArr and normalizedCoordinates are defined and valid
  if (!timeArr[0] || !timeArr[1] || !normalizedCoordinates) {
    core.osd("Please set both start and end times and select a crop area.");
    return;
  }

  // Replace spaces in the filename with backslash-escaped spaces
  const filename = core.status.url.replace("file://", "").replace(/\s/g, "\\ ");

  // Construct the ffmpeg command with preserved backslashes
  const ffmpegCommand = `ffmpeg -ss ${timeArr[0]} -to ${timeArr[1]} -i ${filename} ${useCrop ? `-vf "crop=${normalizedCoordinates.width}:${normalizedCoordinates.height}:${normalizedCoordinates.x}:${normalizedCoordinates.y}" \\` : "\\"}
-c:v libx264 -crf 17 -preset fast -c:a aac -map_metadata -1 -map_chapters -1 -movflags +faststart ${outputFilename} && echo ${outputFilename}`;

  // Ask the user for confirmation
  const userResponse = utils.ask(
    `Do you want to copy the following command to your clipboard?\n\n${ffmpegCommand}`,
  );

  if (userResponse) {
    // Copy the command to the clipboard
    const { status, stdout, stderr } = await utils.exec("/bin/bash", [
      "-c",
      `echo "${ffmpegCommand}" | pbcopy`,
    ]);
    if (status === 0) {
      core.osd("Command copied to clipboard");
    } else {
      core.osd(`Failed to copy to clipboard: ${stderr}`);
    }
  } else {
    core.osd("User clicked Cancel");
  }
}

// Event listeners
input.onMouseDown(input.MOUSE, () => {
  input.onMouseUp(input.MOUSE, ({ x, y }) => {
    if (useCrop) {
      overlay.show();
      core.osd(x.toString());
      updateClickPos(Math.round(x), Math.round(core.window.frame.height - y));
    }
  });
});

input.onKeyDown("c", () => {
  isWaitingForSecondClick = true;
  core.osd("Press 'c' again to cancel or click to set the second position.");
});

input.onKeyDown("alt+c", () => {
  firstClickPos = { x: 0, y: 0 };
  secondClickPos = { x: 0, y: 0 };
  overlay.postMessage("clear-rectangle");
  core.osd("Crop cancelled.");
});

input.onKeyDown("h", () => {
  isHidden = !isHidden;
});

input.onKeyDown("alt+k", async () => {
  if (!useCrop || (secondClickPos.x > 0 && secondClickPos.y > 0)) {
    copyToClipboard();
  } else {
    core.osd("Please select a crop before continuing.");
  }
});
const subOverlayMenu = menu.item("Overlay");

// Menu items
subOverlayMenu.addSubMenuItem(
  menu.item("Show Video Overlay", () => {
    core.osd("Show Video Overlay");
    overlay.show();
  }),
);

subOverlayMenu.addSubMenuItem(
  menu.item("Hide Video Overlay", () => {
    overlay.hide();
  }),
);
menu.addItem(subOverlayMenu);
const subTimeMenu = menu.item("Time");

// Add submenu items with correct key bindings
subTimeMenu.addSubMenuItem(
  menu.item(
    "Set start time",
    () => {
      startTime = getTimePos(0);
      core.osd(`Start time set to: ${startTime}`);
    },
    { keyBinding: "U" },
  ), // Single key binding
);

subTimeMenu.addSubMenuItem(
  menu.item(
    "Set end time",
    () => {
      endTime = getTimePos(1);
      core.osd(`End time set to: ${endTime}`);
    },
    { keyBinding: "Meta+u" },
  ), // Meta (Command) + u
);
subTimeMenu.addSubMenuItem(
  menu.item("Log time", () => {
    core.osd(`Start time: ${startTime} End time: ${endTime}`);
  }), // Meta (Command) + u
);
menu.addItem(subTimeMenu);
menu.addItem(
  menu.item(
    "Toggle crop",
    () => {
      toggleCrop();
    },
    { keyBinding: "Meta+T" },
  ),
);
menu.addItem(
  menu.item(
    "Set output filename",
    () => {
      promptOutputFilename();
    },
    { keyBinding: "Shift+Meta+u" },
  ), // Shift + Meta (Command) + u
);

// Add the parent menu item to the main menu

// Periodic updates
setInterval(updateVariables, 500);
setInterval(postUpdate, 500);

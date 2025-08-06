const {
  standaloneWindow,
  overlay,
  console,
  menu,
  core,
  input,
  utils,
  file,
  preferences,
  playlist,
} = iina;
import * as helpers from "./helpers";
// Initialize overlay
overlay.loadFile("dist/ui/overlay/index.html");
overlay.setClickable(true);

// Global variables
let dimensions, frame, scale, rectangleCoordinates, normalizedCoordinates;
let firstClickPos = { x: 0, y: 0 };
let secondClickPos = { x: 0, y: 0 };
let isWaitingForSecondClick = false;
let isHidden = true;
let timeArr = ["00:00:00.000", secondsToISO(core.status.duration)];
let outputDir = preferences.get("output_dir");
let outputFilename = ""; // Store the output filename globally
let useCrop = false;
let startTime = "00:00:00.000",
  endTime = secondsToISO(core.status.duration);
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

function secondsToISO(time) {
  return new Date(time * 1000).toISOString().substring(11, 23);
}

function getTimePos(index) {
  const timePos = core.status.position;
  // timeArr[index] = new Date(timePos * 1000).toISOString().substring(11, 23);
  timeArr[index] = secondsToISO(timePos);
  return timeArr[index];
}

function promptOutputFilename() {
  const fn = utils.prompt(`Please enter the file name\n\n${filename}`);
  outputFilename = `${fn}.mp4`;
  return outputFilename;
}

async function promptOutputDir() {
  try {
    // @ts-ignore - chooseFile actually returns a Promise despite what the types say
    const tempOutput = await utils.chooseFile(
      "Please select the output directory\n",
      {
        chooseDir: true,
      },
    );

    if (tempOutput) {
      outputDir = tempOutput;
      core.osd(`Output directory set to: ${outputDir}`);
    } else {
      core.osd("No directory selected");
    }

    return tempOutput;
  } catch (error) {
    core.osd(`Error selecting directory: ${error}`);
    return null;
  }
}

function toggleCrop() {
  useCrop = !useCrop;
  core.osd(`Crop ${useCrop ? "enabled" : "disabled"}`);
}

function generateCommand(direct = false) {
  // Ensure timeArr and normalizedCoordinates are defined and valid
  if (!timeArr[0] || !timeArr[1] || !normalizedCoordinates) {
    core.osd("Please set both start and end times and select a crop area.");
    return;
  }

  // Replace spaces in the filename with backslash-escaped spaces
  const filename = core.status.url.replace("file://", "").replace(/\s/g, "\\ ");
  if (direct) {
    // Check if outputDir is set, if not use from preferences or prompt
    // if (outputDir) {
    //   if (preferences.get("output_dir") !== outputDir) {
    //     outputDir = preferences.get("output_dir");
    //   } else {
    //     outputDir = promptOutputDir();
    //     if (!outputDir) {
    //       core.osd("Output directory not selected. Operation cancelled.");
    //       return null;
    //     }
    //   }
    // }

    // Ensure we have an output filename
    if (!outputFilename) {
      outputFilename = promptOutputFilename();
      if (!outputFilename) {
        core.osd("Output filename not provided. Operation cancelled.");
        return null;
      }
    }

    let finalOutputFilename = `${outputDir}/${outputFilename}`;
    return {
      args: `-ss ${timeArr[0]} -to ${timeArr[1]} -i ${filename} ${useCrop ? `-vf crop=${normalizedCoordinates.width}:${normalizedCoordinates.height}:${normalizedCoordinates.x}:${normalizedCoordinates.y}` : ""} -c:v libx264 -crf 17 -preset fast -c:a aac -map_metadata -1 -map_chapters -1 -movflags +faststart ${finalOutputFilename}`.split(
        " ",
      ),
      outputFilename: finalOutputFilename,
    };
  }
  // Construct the ffmpeg command with preserved backslashes
  else {
    return `ffmpeg -ss ${timeArr[0]} -to ${timeArr[1]} -i ${filename} ${useCrop ? `-vf "crop=${normalizedCoordinates.width}:${normalizedCoordinates.height}:${normalizedCoordinates.x}:${normalizedCoordinates.y}" \\` : "\\"}
-c:v libx264 -crf 17 -preset fast -c:a aac -map_metadata -1 -map_chapters -1 -movflags +faststart ${outputFilename} && echo ${outputFilename}`;
  }
}

async function copyToClipboard(command) {
  const ffmpegCommand = generateCommand();
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
async function listFiles() {
  const playlistDir = await utils.chooseFile("Select playlist directory", {
    chooseDir: true,
  });
  const { status, stdout, stderr } = await utils.exec("/bin/bash", [
    "-c",
    `ls ${playlistDir}`,
  ]);
  const filesArray = stdout.split("\n");
  const videoFiles = filesArray
    .filter((file) =>
      file.match(
        /[-\w\s\.]+\.(mp4|webm|mkv|avi|m4v|mov|flv|ogv|3gp|wmv|mts|m2ts|ts)/gim,
      ),
    )
    .map((file) => {
      return `${playlistDir}/${file}`;
    });
  // for (const [index, file] of videoFiles.entries()) {
  //   playlist.add(file, index);
  // }
  videoFiles.reverse().forEach((file) => {
    playlist.add(file);
  });
  // console.log(playlist.list());
  console.log(typeof playlist.list);
  // console.log(`\n\n\nDIRFILES: ${stdout}\n\n\n`);
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
subOverlayMenu.addSubMenuItem(
  menu.item("List files", () => {
    listFiles();
  }),
);

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
// const subTimeMenu = menu.item("Time");
const subOptionsMenu = menu.item("Options");
// Add submenu items with correct key bindings
subOptionsMenu.addSubMenuItem(
  menu.item(
    "Set start time",
    () => {
      startTime = getTimePos(0);
      core.osd(`Start time set to: ${startTime}`);
    },
    { keyBinding: "U" },
  ), // Single key binding
);

subOptionsMenu.addSubMenuItem(
  menu.item(
    "Set end time",
    () => {
      endTime = getTimePos(1);
      core.osd(`End time set to: ${endTime}`);
    },
    { keyBinding: "Meta+u" },
  ), // Meta (Command) + u
);
subOptionsMenu.addSubMenuItem(
  menu.item("Set output directory", () => {
    promptOutputDir();
  }),
);
subOptionsMenu.addSubMenuItem(
  menu.item(
    "Set output filename",
    () => {
      promptOutputFilename();
    },
    { keyBinding: "Shift+Meta+u" },
  ), // Shift + Meta (Command) + u
);
subOptionsMenu.addSubMenuItem(
  menu.item(
    "Toggle crop",
    () => {
      toggleCrop();
    },
    { keyBinding: "Meta+T" },
  ),
);
menu.addItem(subOptionsMenu);
const subFFMPEGMenu = menu.item("FFMPEG");
subFFMPEGMenu.addSubMenuItem(
  menu.item("Initialise ffmpeg", () => {
    helpers.initFFMPEG();
  }), // Meta (Command) + u
);
subFFMPEGMenu.addSubMenuItem(
  menu.item("Download ffmpeg", () => {
    helpers.downloadFFMPEG().then((result) => {
      if (result === true) {
        console.log("Now running the next step...");
        helpers.unzip().then((result) => {
          helpers.logger(`Download and extract successful.`);
        });
      } else {
        console.error(`Download failed: ${result}`);
      }
    });
  }),
);
subFFMPEGMenu.addSubMenuItem(
  menu.item("Show ffmpeg path", () => {
    const ffPath = preferences.get("ffmpeg_path");
    core.osd(ffPath);
  }), // Meta (Command) + u
);
subFFMPEGMenu.addSubMenuItem(
  menu.item("Show command", () => {
    core.osd(generateCommand(true));
    console.log(generateCommand(true));
  }),
);
subFFMPEGMenu.addSubMenuItem(
  menu.item(
    "Run ffmpeg",
    () => {
      let { args, outputFilename } = generateCommand(true);
      let cleanedArgs = args.filter((entry) => entry !== "");
      let executeCommand = utils.ask(
        `Do you want to run this ffmpeg command:\n\nffmpeg ${cleanedArgs.join(" ")}`,
      );
      if (executeCommand) {
        helpers.logger(`Processing ${filename} -> ${outputFilename}`);
        helpers.callFFMPEG(cleanedArgs).then((result) => {
          if (result.status === 0) {
            helpers.logger(`Video successfully processed: ${outputFilename}`);
            executeCommand = false;
          }
        });
      }
    },
    { keyBinding: "Command+Shift+R" },
  ), // Meta (Command) + u
);
menu.addItem(subFFMPEGMenu);
// Add the parent menu item to the main menu

// Periodic updates
setInterval(updateVariables, 500);
setInterval(postUpdate, 500);

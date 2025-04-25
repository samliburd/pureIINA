const { core, console, http, utils, exec } = iina;

const FFMPEG_URL = "https://evermeet.cx/ffmpeg/get/ffmpeg/zip";
const FFMPEG_ZIP_PATH = utils.resolvePath("@tmp/ffmpeg.zip");
const BINARY_PATH = utils.resolvePath("@data/bin/");

function logger(msg) {
  console.log(msg);
  core.osd(msg);
}

export async function downloadFFMPEG() {
  try {
    await http.download(FFMPEG_URL, FFMPEG_ZIP_PATH);
    console.log(`ffmpeg downloaded to ${FFMPEG_ZIP_PATH}`);
    return null;
  } catch (e) {
    console.log(e);
    return e.toString();
  }
}

export async function getFfmpegPath() {
  try {
    const { status, stdout, stderr } = await utils.exec("/bin/bash", [
      "-c",
      "export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin:/opt/local/bin && command -v ffmpeg",
      // "echo $PATH",
    ]);
    if (status === 0) {
      logger(stdout);
    } else {
      logger(`Output: ${stdout} ${stderr}`);
    }
  } catch (error) {
    logger(`Could not find ffmpeg`);
  }
}

export async function unzip() {
  try {
    // Execute the unzip command
    const { status, stdout, stderr } = await utils.exec("/usr/bin/unzip", [
      "-o",
      `${FFMPEG_ZIP_PATH}`,
      "-d",
      `${BINARY_PATH}`,
    ]);

    // Check the exit status of the command
    if (status === 0) {
      // If the command was successful, display success message
      logger(`ffmpeg extracted to ${BINARY_PATH}/ffmpeg`);
    } else {
      // If there's a non-zero status, consider it an error and display stderr
      logger(`Error extracting ffmpeg: ${stderr || stdout}`);
    }
  } catch (error) {
    // If there's an exception during the command execution, display the error
    logger(`Unzip failed: ${error.message}`);
  }
}

// export function chmod() {}
export function findBinary() {
  let path = "ffmpeg";
  const searchList = ["@data/ffmpeg", "ffmpeg"];
  for (const item of searchList) {
    if (utils.fileInPath(item)) {
      console.log(`Found ffmpeg; using ${item}`);
      core.osd(`Found ffmpeg; using ${item}`);
      path = item;
      break;
    }
  }
  return path;
}

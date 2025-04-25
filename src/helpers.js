const { core, console, http, utils, exec, file } = iina;

const FFMPEG_URL = "https://evermeet.cx/ffmpeg/get/ffmpeg/zip";
const FFMPEG_ZIP_PATH = utils.resolvePath("@tmp/ffmpeg.zip");
const BINARY_DIR_PATH = utils.resolvePath("@data/bin/");
let FFMPEG_BINARY_PATH;

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
      "command -v ffmpeg", // "export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin:/opt/local/bin && command -v ffmpeg",
      // "echo $PATH",
    ]);
    if (status === 0) {
      FFMPEG_BINARY_PATH = stdout;
      logger(`ffmpeg found at ${FFMPEG_BINARY_PATH}`);
    } else if (status !== 0 && file.exists("@data/bin/ffmpeg")) {
      FFMPEG_BINARY_PATH = `${BINARY_DIR_PATH}/ffmpeg`;
      logger(`ffmpeg found at: ${FFMPEG_BINARY_PATH}`);
    } else {
      const askDownload = utils.ask("Do you want to download ffmpeg?");
      if (askDownload) {
        await downloadFFMPEG().then(unzip);
        FFMPEG_BINARY_PATH = `${BINARY_DIR_PATH}/ffmpeg`;
        logger(`ffmpeg found at: ${FFMPEG_BINARY_PATH}`);
      } else if (!askDownload) {
        const userPath = utils.prompt(
          "Please enter the PATH to ffmpeg.\n\nTyping `which ffmpeg` into your terminal will show you where ffmpeg is installed.\n\nCommon locations include:\n/opt/homebrew/bin/ffmpeg\n/usr/local/bin/ffmpeg\n/opt/local/bin/ffmpeg",
        );
        if (file.exists(userPath)) {
          FFMPEG_BINARY_PATH = `${userPath}`;
          logger(`ffmpeg found at: ${userPath}`);
        }
      }
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
      `${BINARY_DIR_PATH}`,
    ]);

    // Check the exit status of the command
    if (status === 0) {
      // If the command was successful, display success message
      logger(`ffmpeg extracted to ${BINARY_DIR_PATH}/ffmpeg`);
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

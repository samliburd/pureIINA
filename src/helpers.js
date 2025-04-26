import { stderr } from "process";

const { core, console, http, utils, exec, file, preferences } = iina;

const FFMPEG_URL = "https://evermeet.cx/ffmpeg/get/ffmpeg/zip";
const FFMPEG_ZIP_PATH = utils.resolvePath("@tmp/ffmpeg.zip");
const BINARY_DIR_PATH = utils.resolvePath("@data/bin/");
let FFMPEG_BINARY_PATH,
  helpTextShown = false;

export function logger(msg) {
  console.log(msg);
  core.osd(msg);
}

export async function downloadFFMPEG() {
  try {
    await http.download(FFMPEG_URL, FFMPEG_ZIP_PATH);
    console.log(`ffmpeg downloaded to ${FFMPEG_ZIP_PATH}`);
    return true;
  } catch (e) {
    console.log(e);
    return e.toString();
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
      // logger(`Error extracting ffmpeg: ${stderr || stdout}`);
    }
    return status;
  } catch (error) {
    // If there's an exception during the command execution, display the error
    logger(`Unzip failed: ${error.message}`);
  }
}

export async function initFFMPEG() {
  if (!helpTextShown) {
    const helpText /**/ =
      utils.ask(`If \`ffmpeg_path\` is not set in the plugin's preferences (⌘,) this function will try to find ffmpeg in the plugin's data dir and then the system $PATH.
  \n\nIf it is not in either location it will prompt to download ffmpeg to the data dir.\n\n
  If you know where ffmpeg is installed, decline this prompt and enter the location in the next prompt.`);
  }
  helpTextShown = true;
  if (file.exists(preferences.get("ffmpeg_path"))) {
    FFMPEG_BINARY_PATH = preferences.get("ffmpeg_path");
    logger(`ffmpeg found at ${FFMPEG_BINARY_PATH}`);
  } else if (!file.exists(preferences.get("ffmpeg_path"))) {
    const userPath = utils.prompt(
      `Please enter the PATH to ffmpeg.

Typing \`which ffmpeg\` into your terminal will show you where ffmpeg is installed.

Common locations include:
  /opt/homebrew/bin/ffmpeg
  /usr/local/bin/ffmpeg
  /opt/local/bin/ffmpeg`,
    );
    if (file.exists(userPath)) {
      FFMPEG_BINARY_PATH = userPath;
      logger(`ffmpeg found at: ${FFMPEG_BINARY_PATH}`);
    } else if (file.exists("@data/bin/ffmpeg")) {
      FFMPEG_BINARY_PATH = `${BINARY_DIR_PATH}/ffmpeg`;
      logger(`ffmpeg found at: ${FFMPEG_BINARY_PATH}`);
    } else {
      try {
        const { status, stdout, stderr } = await utils.exec("/bin/bash", [
          "-c",
          "export PATH=$PATH:/opt/homebrew/bin:/usr/local/bin:/opt/local/bin && command -v ffmpeg",
          // "echo $PATH",
        ]);
        if (status === 0) {
          FFMPEG_BINARY_PATH = stdout;
          logger(`ffmpeg found at ${FFMPEG_BINARY_PATH}`);
        } else {
          const askDownload = utils.ask("Do you want to download ffmpeg?\n");
          if (askDownload) {
            await downloadFFMPEG().then(unzip);
            FFMPEG_BINARY_PATH = `${BINARY_DIR_PATH}/ffmpeg`;
            logger(`ffmpeg found at: ${FFMPEG_BINARY_PATH}`);
          }
        }
      } catch (error) {
        logger(`Could not find ffmpeg`);
      }
    }
    if (FFMPEG_BINARY_PATH) {
      preferences.set("ffmpeg_path", FFMPEG_BINARY_PATH);
      logger("Saved ffmpeg path to preferences");
    } else {
      logger("Failed to locate ffmpeg, path not saved to preferences");
    }
  }
}

export async function testFFMPEG() {
  const inputFilename = core.status.url
    .replace("file://", "")
    .replace(/\s/g, "\\ ");
  logger(inputFilename);
  let outputDir;
  if (preferences.get("output_dir")) {
    outputDir = preferences.get("output_dir");
  } else {
    outputDir = utils.chooseFile("Please select the output directory\n", {
      chooseDir: true,
    });
  }
  console.log(`Output dir: ${outputDir}`);
  let outputFilename = utils.prompt(
    "Enter output filename (without extension):\n",
  );
  console.log(`Output filename: ${outputFilename}`);
  let finalOutputName = `${outputDir}/${outputFilename}.mp4`;
  try {
    logger(`Processing ${inputFilename} -> ${finalOutputName}`);
    const { status, stdout, stderr } = await utils.exec(
      preferences.get("ffmpeg_path"),
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-i",
        inputFilename,
        "-vf",
        "scale=1280:720",
        `${finalOutputName}`,
        "-y",
      ],
    );
    console.log(stdout);
    console.log(stderr);
    if (status === 0) {
      logger(`Video successfully processed: ${finalOutputName}`);
    }
  } catch (error) {
    logger(`${stderr || error}`);
  }
}

export async function callFFMPEG(options) {
  const ffmpegOptions = ["-hide_banner", "-loglevel", "warning", "-y"];
  console.log("\n\n\n\n\nOPTIONS:\n\n\n\n");
  console.log([...ffmpegOptions, ...options]);
  try {
    const { status, stdout, stderr } = await utils.exec(
      preferences.get("ffmpeg_path"),
      [...ffmpegOptions, ...options],
    );

    console.log(stdout);
    console.log(stderr);
    return { status, stdout, stderr };
  } catch (error) {
    logger(`${stderr || error}`);
    return { status: 1, stdout: "", stderr: error.stderr || error };
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

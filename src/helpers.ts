

const { core, console, http, utils, file, preferences } = iina;

const FFMPEG_URL = "https://evermeet.cx/ffmpeg/get/ffmpeg/zip";
const FFMPEG_ZIP_PATH = utils.resolvePath("@tmp/ffmpeg.zip");
const BINARY_DIR_PATH = utils.resolvePath("@data/bin/");
let FFMPEG_BINARY_PATH: string | undefined,
  helpTextShown = false;

export function logger(msg: string): void {
  console.log(msg);
  core.osd(msg);
}

export async function downloadFFMPEG(): Promise<boolean | string> {
  try {
    await http.download(FFMPEG_URL, FFMPEG_ZIP_PATH);
    console.log(`ffmpeg downloaded to ${FFMPEG_ZIP_PATH}`);
    return true;
  } catch (e: any) {
    console.log(e);
    return e.toString();
  }
}

export async function unzip(): Promise<number | undefined> {
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
  } catch (error: any) {
    // If there's an exception during the command execution, display the error
    logger(`Unzip failed: ${error.message}`);
  }
}

export async function findFFMPEGPath(): Promise<string | null> {
  const prefPath = preferences.get("ffmpeg_path");

  if (prefPath && file.exists(prefPath)) {
    FFMPEG_BINARY_PATH = prefPath;
    logger(`ffmpeg found at ${FFMPEG_BINARY_PATH}`);
    return prefPath;
  }

  // Search system PATHs dynamically
  try {
    const { status, stdout } = await utils.exec("/bin/bash", [
      "-ilc",
      "export PATH=$PATH:$HOME/.local/bin:$HOME/miniconda3/envs/default/bin:/opt/homebrew/bin:/usr/local/bin:/opt/local/bin && which -a ffmpeg",
    ]);

    if (status === 0 && stdout) {
      const paths = stdout.split("\n").filter(p => p.trim().length > 0);
      const uniquePaths = Array.from(new Set(paths));
      if (uniquePaths.length > 0) {
        FFMPEG_BINARY_PATH = uniquePaths[0];
        preferences.set("ffmpeg_path", FFMPEG_BINARY_PATH);
        logger(`ffmpeg auto-detected at ${FFMPEG_BINARY_PATH}`);
        return FFMPEG_BINARY_PATH;
      }
    }
  } catch (error: any) {
    logger(`Could not find ffmpeg: ${error.message}`);
  }

  return null;
}

export function setFFMPEGPath(newPath: string): boolean {
  if (file.exists(newPath)) {
    FFMPEG_BINARY_PATH = newPath;
    preferences.set("ffmpeg_path", newPath);
    return true;
  }
  return false;
}

export async function callFFMPEG(
  ffmpegPath: string,
  options: string[],
  onProgress?: (timeUs: number) => void
): Promise<{ status: number; stdout: string; stderr: string }> {
  let ffmpegOptions = ["-nostdin", "-hide_banner", "-loglevel", "warning", "-y"];
  if (onProgress) {
    ffmpegOptions = [...ffmpegOptions, "-progress", "-", "-nostats"];
  }

  console.log("\n\n\n\n\nOPTIONS:\n\n\n\n");
  console.log([...ffmpegOptions, ...options]);
  try {
    let stdoutHook = undefined;
    if (onProgress) {
      stdoutHook = (chunk: string) => {
        const match = chunk.match(/out_time_us=(\d+)/);
        if (match && match[1]) {
          onProgress(parseInt(match[1], 10));
        }
      };
    }

    const { status, stdout, stderr } = await utils.exec(
      ffmpegPath,
      [...ffmpegOptions, ...options],
      null,
      stdoutHook
    );

    console.log(stdout);
    console.log(stderr);
    return { status, stdout, stderr };
  } catch (error: any) {
    logger(`${error.stderr || error}`);
    return { status: 1, stdout: "", stderr: error.stderr || error };
  }
}

// export function chmod() {}
export function findBinary(): string {
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

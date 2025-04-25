const { core, console, http, utils, exec } = iina;

const FFMPEG_URL =
  "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-darwin-arm64";

export async function downloadFFMPEG() {
  try {
    await http.download(FFMPEG_URL, "@data/ffmpeg");
    return null;
  } catch (e) {
    return e.toString();
  }
}

export async function makeExecutable() {
  const resolvedPath = utils.resolvePath("@data/ffmpeg");
  return await utils.exec("/bin/chmod", ["+x", resolvedPath]);
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

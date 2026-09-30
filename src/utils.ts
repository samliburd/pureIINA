const { core, utils } = iina;
import { FFMPEG_DEFAULTS } from "./constants";
import { Point, Rect } from "./types";

export class TimeUtils {
  static secondsToISO(time: number): string {
    return new Date(time * 1000).toISOString().substring(11, 23);
  }
  static getCurrentTimePosition(): string {
    return TimeUtils.secondsToISO(core.status.position || 0);
  }

  static isoToSeconds(iso: string): number {
    const parts = iso.split(":");
    if (parts.length !== 3) return 0;
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  }
}

export class CoordinateUtils {


  static parseCropString(cropString: string): Rect | null {
    const parts = cropString.split(":");
    if (parts.length !== 4) {
      return null;
    }

    const [width, height, x, y] = parts.map((part) =>
      parseInt(part.trim(), 10),
    );

    if (parts.some((part) => isNaN(parseInt(part.trim(), 10)))) {
      return null;
    }

    return { width, height, x, y };
  }

  static cropToCoordsString(normalizedCoordinates: Rect | null): string {
    if (!normalizedCoordinates) {
      return "0:0:0:0";
    }
    return `${normalizedCoordinates.width}:${normalizedCoordinates.height}:${normalizedCoordinates.x}:${normalizedCoordinates.y}`;
  }



  // (getRectangleCoordinates, getNormalizedCoordinates, etc.)
}

export class UserPrompts {
  static async promptOutputDir(): Promise<string | null> {
    try {
      const tempOutput = await utils.chooseFile(
        "Please select the output directory\n",
        { chooseDir: true },
      );
      if (tempOutput) {
        core.osd(`Output directory set to: ${tempOutput}`);
        return tempOutput;
      }
      core.osd("No directory selected");
      return null;
    } catch (error) {
      core.osd(`Error selecting directory: ${error}`);
      return null;
    }
  }


}

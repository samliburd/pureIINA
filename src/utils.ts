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
  static getRectangleCoordinates(firstClick: Point, secondClick: Point): Rect {
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

  static getNormalizedCoordinates(coordinates: Rect, scale: number): Rect {
    // Helper function to force rounding to the nearest even integer
    const toEven = (val: number) => Math.round(val / 2) * 2;

    return {
      x: toEven(coordinates.x * scale),
      y: toEven(coordinates.y * scale),
      width: toEven(coordinates.width * scale),
      height: toEven(coordinates.height * scale),
    };
  }

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

  static denormalizeCoordinates(normalizedCoords: Rect, scale: number): Rect {
    return {
      x: Math.round(normalizedCoords.x / scale),
      y: Math.round(normalizedCoords.y / scale),
      width: Math.round(normalizedCoords.width / scale),
      height: Math.round(normalizedCoords.height / scale),
    };
  }

  static coordsToClickPositions(coordinates: Rect, frameHeight: number): { firstClick: Point, secondClick: Point } {
    const firstClick = {
      x: coordinates.x,
      y: frameHeight - coordinates.y,
    };

    const secondClick = {
      x: coordinates.x + coordinates.width,
      y: frameHeight - (coordinates.y + coordinates.height),
    };

    return { firstClick, secondClick };
  }

  // (getRectangleCoordinates, getNormalizedCoordinates, etc.)
}

export class UserPrompts {
  static promptOutputFilename(currentFilename: string): string | null {
    const fn = utils.prompt(`Please enter the file name\n\n${currentFilename}`);
    return fn ? `${fn}.${FFMPEG_DEFAULTS.container}` : null;
  }

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

  static confirmAction(message: string): boolean {
    return utils.ask(message);
  }

  static promptCropEdit(currentCrop: string): string | null {
    const helpText = `Edit Crop Area\n\nCurrent crop: crop=${currentCrop}\n\nEnter crop values in format: width:height:x:y\nExample: 1280:720:100:50\n\nCurrent crop: ${currentCrop}`;
    return utils.prompt(helpText) || null;
  }

  static showCommand(message: string): boolean {
    return utils.ask(message);
  }
}

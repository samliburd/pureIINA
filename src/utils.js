const { core, utils } = iina;
import { FFMPEG_DEFAULTS } from "./constants";

export class TimeUtils {
  static secondsToISO(time) {
    return new Date(time * 1000).toISOString().substring(11, 23);
  }
  static getCurrentTimePosition() {
    return TimeUtils.secondsToISO(core.status.position);
  }
}

export class CoordinateUtils {
  static getRectangleCoordinates(firstClick, secondClick) {
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

  static getNormalizedCoordinates(coordinates, scale) {
    return {
      x: Math.round(coordinates.x * scale),
      y: Math.round(coordinates.y * scale),
      width: Math.round(coordinates.width * scale),
      height: Math.round(coordinates.height * scale),
    };
  }

  static parseCropString(cropString) {
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

  static cropToCoordsString(normalizedCoordinates) {
    if (!normalizedCoordinates) {
      return "0:0:0:0";
    }
    return `${normalizedCoordinates.width}:${normalizedCoordinates.height}:${normalizedCoordinates.x}:${normalizedCoordinates.y}`;
  }

  static denormalizeCoordinates(normalizedCoords, scale) {
    return {
      x: Math.round(normalizedCoords.x / scale),
      y: Math.round(normalizedCoords.y / scale),
      width: Math.round(normalizedCoords.width / scale),
      height: Math.round(normalizedCoords.height / scale),
    };
  }

  static coordsToClickPositions(coordinates, frameHeight) {
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
  static promptOutputFilename(currentFilename) {
    const fn = utils.prompt(`Please enter the file name\n\n${currentFilename}`);
    return fn ? `${fn}.${FFMPEG_DEFAULTS.container}` : null;
  }

  static async promptOutputDir() {
    try {
      const tempOutput = await utils.chooseFile("Please select the output directory\n", { chooseDir: true });
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

  static confirmAction(message) {
    return utils.ask(message);
  }

  static promptCropEdit(currentCrop) {
    const helpText = `Edit Crop Area\n\nCurrent crop: crop=${currentCrop}\n\nEnter crop values in format: width:height:x:y\nExample: 1280:720:100:50\n\nCurrent crop: ${currentCrop}`;
    return utils.prompt(helpText);
  }
}

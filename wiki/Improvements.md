# Improvements & Future Work

With the codebase successfully refactored into clean modules (Core, Menus, Utils) and the React overlay infrastructure wired up, the foundation is solid. The following improvements focus on feature enhancements and UX.

## 1. Interactive Drag-to-Crop
Currently, cropping relies on a somewhat clunky two-click process captured by the main IINA input API. Now that the React overlay is fully functional and communicating with the main process, this should be migrated:
- Enable `overlay.setClickable(true)` when crop mode is toggled.
- Implement a click-and-drag marquee selector in `ui/overlay/app.jsx`.
- Render a translucent darkened mask over the video with a clear "cutout" for the selected crop rectangle.
- Pass the final dragged coordinates back to `core.js` via `iina.postMessage`.

## 2. Progress Reporting
When running FFmpeg directly (`Shift + Cmd + r`), the user currently receives no feedback until the entire process finishes. 
- **Improvement:** Pass FFmpeg's `-progress` flag or parse `stderr` chunks inside `utils.exec`.
- **UI:** Send this progress data to the React overlay to render a live loading bar, vastly improving the user experience during long encodes.

## 3. Dedicated Preference Page
pureIINA declares `pref.html` in `Info.json` to allow users to set preferences natively inside IINA's settings menu.
- **Improvement:** Build out `pref.html` (potentially using another React target or simple HTML/JS bindings) to allow users to define their default output directory, preferred FFmpeg codecs (e.g., switching from `libx264` to `hevc_videotoolbox`), and default CRF values without having to hardcode them.

## 4. FFmpeg Setup Flow
The FFmpeg initialization (`helpers.initFFMPEG`) prompts the user to locate or download the binary. This flow could be made more robust with clearer error handling and dialogs if the download fails or the binary path is invalid.
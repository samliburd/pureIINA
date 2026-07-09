# Architecture

pureIINA is built using the standard IINA plugin structure, utilizing Parcel for bundling modern JavaScript into IINA-compatible entry points.

## Project Structure
- `Info.json`: The manifest file declaring plugin metadata, permissions (file-system, overlay, osd), and entry points.
- `package.json`: Contains the Parcel build scripts and dependencies.
- `src/index.js`: The **Main Entry** script. This runs once per player window. It orchestrates state (`AppState`), FFmpeg command building (`FFMPEGCommandBuilder`), and user input handling (`VideoProcessor`).
- `src/helpers.js`: Contains utility functions for interacting with the file system, network (`iina.http`), and executing processes (specifically for finding, downloading, and running FFmpeg).
- `src/global.js`: The **Global Entry** script. Currently unused, but loaded once when IINA starts.
- `ui/overlay/`: Contains the HTML, CSS, and JS (`overlay.js`) for the interactive crop selection interface. It communicates with `src/index.js` via the IINA webview messaging API (`iina.postMessage` / `iina.onMessage`).
- `ui/window/`: Contains a stubbed HTML interface for a standalone window. Not currently integrated into the main plugin flow.

## Communication Workflow
1. The user interacts with the IINA window (clicking the mouse or pressing keys).
2. `src/index.js` captures these inputs via `iina.input`.
3. If the user clicks the video to crop, `src/index.js` calculates the relative coordinates based on the window size and video dimensions.
4. `src/index.js` posts a message (`overlay.postMessage('update', data)`) to the Overlay Webview.
5. `ui/overlay/overlay.js` receives the data and manipulates the DOM to render the pink crop rectangle and update coordinate text.

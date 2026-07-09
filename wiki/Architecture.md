# Architecture

pureIINA is built using the standard IINA plugin structure, utilizing Parcel for bundling modern JavaScript into IINA-compatible entry points. The codebase has been thoughtfully modularized to separate concerns.

## Project Structure
- `Info.json`: The manifest file declaring plugin metadata, permissions (file-system, overlay, osd), and entry points.
- `package.json`: Contains the Parcel build scripts and dependencies.

### Source Code (`src/`)
- `index.js`: The **Main Entry** script. This runs once per player window. It acts as the orchestrator, initializing state, starting event listeners, and managing the update intervals.
- `core.js`: Contains the domain logic. Houses `AppState` (manages clip boundaries and output settings), `FFMPEGCommandBuilder` (constructs the final terminal command), and `VideoProcessor` (handles crop calculations and FFmpeg execution).
- `menus.js`: Responsible for constructing and wiring up the `IINA` dropdown menus (Options, FFmpeg, Overlay).
- `utils.js`: Houses pure utility classes like `TimeUtils`, `CoordinateUtils` (for math and string parsing), and `UserPrompts` (for IINA dialog boxes).
- `constants.js`: Centralized configuration (e.g., default FFmpeg codecs and regex patterns).
- `helpers.js`: Contains utility functions for file system interactions, network requests, and bootstrapping the FFmpeg binary.

### User Interface (`ui/overlay/`)
- Contains the HTML and React codebase (`app.jsx`, `index.js`) for the interactive Heads-Up Display (HUD) overlay.

## Communication Workflow
1. The user interacts with the IINA window (clicking the mouse or pressing keys).
2. `src/index.js` captures these inputs via `iina.input` and routes them to the `VideoProcessor`.
3. Periodically, `src/index.js` posts a message (`overlay.postMessage('update', data)`) containing the current video time and dimensions to the Overlay Webview.
4. The React application in `ui/overlay/app.jsx` receives the data via `window.iina.onMessage` and updates its component state to render the UI on top of the video in real-time.
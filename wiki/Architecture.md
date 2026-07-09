# Architecture

pureIINA is built using the standard IINA plugin structure, utilizing Parcel for bundling modern JavaScript into IINA-compatible entry points.

## Project Structure
- `Info.json`: The manifest file declaring plugin metadata, permissions (file-system, overlay, osd), and entry points.
- `package.json`: Contains the Parcel build scripts and dependencies.
- `src/index.js`: The **Main Entry** script. This runs once per player window. It orchestrates state (`AppState`), FFmpeg command building (`FFMPEGCommandBuilder`), and user input handling (`VideoProcessor`).
- `src/helpers.js`: Contains utility functions for interacting with the file system, network (`iina.http`), and executing processes (specifically for finding, downloading, and running FFmpeg).

## Communication Workflow
1. The user interacts with the IINA window (clicking the mouse or pressing keys).
2. `src/index.js` captures these inputs via `iina.input`.
3. If the user clicks the video to crop, `src/index.js` calculates the relative coordinates based on the window size and video dimensions.

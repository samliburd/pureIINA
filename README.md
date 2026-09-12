# pureIINA

**pureIINA** is a plugin for the [IINA](https://iina.io/) video player for macOS. It extends IINA's capabilities by providing interactive tools to trim and crop videos directly within the player, and then generate or execute an FFmpeg command to process the video.

This is incredibly useful for users who want to quickly extract a specific scene or crop a portion of a video without needing to use a heavy video editing suite or manually guess crop coordinates for FFmpeg.

Wouldn't have been possible without the excellent work here:
https://github.com/4ndrs/PureMPV

## Core Features

- **Interactive Sidebar:** A rich React-based sidebar provides intuitive controls for cropping, trimming, setting output directories, and tracking FFmpeg encoding progress.
- **Time Trimming:** Set precise start and end times for the video segment you wish to extract directly from the sidebar or via shortcuts.
- **Visual Cropping & Precise Sliders:** Click on the video to define a crop rectangle using a two-click system, or use the sidebar's X/Y sliders and text inputs for pixel-perfect adjustments.
- **React Overlay (HUD):** Displays a modern Heads-Up Display in the bottom-right corner with real-time video statistics and coordinates.
- **FFmpeg Integration:** Automatically build the correct FFmpeg command with the selected times and crop dimensions. You can view the live command in the sidebar, copy it to your clipboard, or run it directly in the background within IINA with live progress tracking.
- **Automatic Dependency Management:** If FFmpeg is not installed on the system, pureIINA can automatically download and configure a local copy of FFmpeg for you.

## Installation & Build

pureIINA is built with [Parcel](https://parceljs.org/), React, and TypeScript.

1. Clone the repository into your IINA plugins directory (usually `~/Library/Application Support/com.colliderli.iina/plugins/`).
2. Install dependencies (requires Yarn PnP):
   ```bash
   yarn install
   ```
3. Build the plugin:
   ```bash
   yarn build
   ```
4. Open IINA, go to **Settings > Plugins**, and ensure `pureIINA` is enabled.
5. To access the interactive controls, toggle the sidebar using IINA's menu bar (`View` -> `Sidebar` -> `pureIINA`).

## Usage & Keyboard Shortcuts

Once pureIINA is enabled, you can control it via the interactive sidebar, the menu bar (`Plugin` -> `pureIINA`), or using the following shortcuts:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `c` | **Start/Complete Crop** | Activates the crop mode for the second click to complete the rectangle. |
| `Option + c` | **Cancel Crop** | Clears the current crop selection. |
| `Option + k` | **Copy Command** | Generates the FFmpeg command and copies it to your clipboard. |
| `u` | **Set Start Time** | Sets the current video position as the start time for the cut. |
| `Cmd + u` | **Set End Time** | Sets the current video position as the end time for the cut. |
| `Shift + Cmd + u`| **Set Output Filename**| Prompts the user to set a custom output file name. |
| `Cmd + t` | **Toggle Crop** | Enables or disables the crop filter from being included in the final FFmpeg command. |
| `Cmd + e` | **Edit Crop** | Manually enter precise crop coordinates (width:height:x:y). |
| `Shift + Cmd + r`| **Run FFmpeg** | Directly executes the FFmpeg encoding process in the background. |

## Architecture

The plugin utilizes a modular TypeScript architecture:
- `src/index.ts`: Main entry orchestrator.
- `src/core.ts`: Domain logic, state management (`AppState`), and FFmpeg command generation.
- `src/menus.ts`: IINA menu bar bindings.
- `src/utils.ts` & `src/helpers.ts`: Pure utility functions and system integration (FS/Network).
- `ui/overlay/`: Contains the React Heads-Up Display application injected via IINA's Webview API.
- `ui/sidebar/`: Contains the React interactive sidebar providing UI controls and live progress tracking.

## License
ISC

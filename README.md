# iinatools

**iinatools** is a plugin for the [IINA](https://iina.io) macOS media player. It adds a powerful sidebar-based UI that allows you to easily trim video clips and apply crop regions, then preview or execute the FFmpeg command directly from within the player.

This plugin is a complete, ground-up rebuild of the legacy `pureiina` plugin, designed for stability, efficiency, and zero polling overhead.

## Features

- **Trim**: Easily set in and out points at your current playback position with a single click.
- **Crop**: Enter a crop string (`W:H:X:Y`) or use sliders, and see a live visual crop box directly on the video.
- **Direct Execution**: Run FFmpeg directly via the sidebar to produce a new file without leaving IINA.
- **HDR Detection**: Automatically detects HDR content and applies the correct tone-mapping filter chain (zscale/Hable) to prevent washed-out colors.
- **FFmpeg Management**: Auto-discovers FFmpeg on your system (Homebrew, MacPorts, Conda), allows manual path overrides, and can even download a bundled binary for you.

## Installation

1. Download or clone this repository.
2. In IINA, open **Settings > Plugins**.
3. Click the **Load** button and select the `iinatools` directory.

### Accessing the Sidebar

You can open the plugin interface by navigating to **Plugin > Show plugin panel** in the macOS menu bar.

## Usage

1. **Set Trim Points**: Play the video and click **Set Start** or **Set End** in the sidebar to capture the current timestamps.
2. **Set Output**: Specify your desired output filename. You can optionally set a specific output directory; otherwise, it defaults to the same directory as the source video.
3. **Crop (Optional)**: Toggle "Crop Mode: ON". Adjust the crop region using the text input or the X/Y sliders. A pink rectangle will appear over the video to preview your crop.
4. **Export**: 
   - Click **Show Command** to view and copy the raw FFmpeg command to your clipboard.
   - Or, click **Run FFmpeg** to encode the clip directly. Progress will be displayed in the sidebar.

## Known Issues (IINA 1.5.0 Beta)

Currently, there are a few known quirks when running on the **IINA 1.5.0 Beta**:
- **Reloading Plugins**: Clicking "Reload Plugins" in the IINA settings may cause the application to crash.
- **Toolbar Buttons**: The plugin button on the video control toolbar (along with other toolbar items) may occasionally become unclickable due to issues in the beta's overlay rendering. Always use the **Plugin > Show plugin panel** menu bar item if the UI button is unresponsive.

## Development & Architecture

iinatools is built with TypeScript and React, bundled via Parcel. 

To build the project locally:

```bash
npm install
npm run build
```

For a comprehensive deep dive into the plugin's internal workings, IPC messaging, coordinate normalization math, and FFmpeg integration, please see the [ARCHITECTURE.md](ARCHITECTURE.md) guide.

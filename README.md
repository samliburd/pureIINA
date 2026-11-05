# pureIINA

> **Precision Video Trimming, Interactive Visual Cropping, and FFmpeg Automation Plugin for IINA (macOS)**

`pureIINA` is a media processing plugin designed specifically for the macOS open-source media player [IINA](https://iina.io) (inspired by the `purempv` script). It bridges interactive playback inspection with the power of FFmpeg, allowing you to visually cut, crop, tone-map, and export video clips directly from the player interface without opening a heavy non-linear video editor.

---

## High-Level Summary

`pureIINA` follows a **non-destructive, visual-first authoring philosophy**:

1. **Scrub & Mark**: Use IINA's playback controls to find exact scenes and set millisecond-accurate start and end points.
2. **Visual Framing**: Turn on Crop Mode to display a real-time, click-through bounding box overlaid onto the video canvas. Adjust spatial framing with live offset sliders.
3. **Smart Tone-Mapping**: Automatically detect High Dynamic Range (HDR10/PQ or HLG) content and apply filmic Hable tonemapping to standard BT.709 SDR during export.
4. **Export Your Way**: Execute transcodes directly inside IINA with a real-time progress bar, or generate copy-pasteable, shell-escaped `ffmpeg` CLI commands for your terminal workflows.

---

## Key Features

- ✂️ **Sub-Millisecond Trimming**: Capture precise cut boundaries (`HH:MM:SS.mmm`) from the current playback position.
- 📐 **Interactive Overlay HUD**: Real-time visual bounding box overlaid directly on the video canvas, automatically scaled to window geometry and constrained to even dimensions for YUV420p encoding compliance.
- 🌈 **Automated HDR-to-SDR Tonemapping**: Seamlessly converts wide-gamut HDR10 and HLG streams to crisp BT.709 SDR using `zscale` and Hable curve tonemapping.
- ⚡ **Dual Execution Modes**:
  - **In-App Transcode**: Headless background execution with live percentage progress tracking.
  - **CLI Command Generation**: One-click generation of fully optimized shell commands ready for terminal execution.
- 🔍 **One-Click FFmpeg Setup**: Built-in system path discovery for Homebrew, MacPorts, and Conda, plus automated one-click downloading and extraction of static macOS FFmpeg binaries.

---

## Prerequisites

- **macOS**: 10.13 (High Sierra) or later.
- **IINA Media Player**: [v1.3.0](https://iina.io) or later with plugin support enabled.
- **Node.js & Yarn**: Node.js $\ge 18$ and Yarn (or npm) to build the plugin assets.
- **FFmpeg**: System binary (e.g., via Homebrew: `brew install ffmpeg`) or downloaded automatically via the plugin.

---

## Installation & Setup

### 1. Clone into IINA's Plugin Directory

Clone the repository directly into IINA's local plugins directory:

```bash
mkdir -p "$HOME/Library/Application Support/com.colliderli.iina/plugins"
cd "$HOME/Library/Application Support/com.colliderli.iina/plugins"
git clone https://github.com/samliburd/pureIINA.git
cd pureIINA
```

### 2. Install Dependencies

Install required dependencies using Yarn:

```bash
yarn install
```

_(Note: [`.yarnrc.yml`](./.yarnrc.yml) is pre-configured to support local `node_modules` and approved Git dependencies)._

### 3. Build the Plugin

Compile the background controller and React webview targets:

```bash
yarn build
```

This compiles:

- `dist/index.js` (background lifecycle & event script)
- `dist/ui/sidebar/` (sidebar control panel)
- `dist/ui/overlay/` (transparent video canvas HUD)

### 4. Enable in IINA

1. Launch **IINA**.
2. Open **Preferences** (`Cmd + ,`) and navigate to the **Plugins** tab.
3. Ensure **pureIINA** is checked and enabled.
4. Open any video file and toggle the sidebar (`Cmd + Shift + S` or click the sidebar icon) to access the **pureIINA** tab.

---

## How-To Guide & Core Workflows

### Workflow 1: Precision Video Trimming

1. Play or scrub to the desired beginning of your clip.
2. Click **Set Start** in the sidebar. The start timestamp updates to the current playback time (`HH:MM:SS.mmm`).
3. Scrub to the end of the scene and click **Set End**.
4. Enter your desired output filename in the **Output Filename** field (e.g., `clip.mp4`). If you omit the extension, `.mp4` is automatically appended.

### Workflow 2: Visual Framing with Live Crop Mode

1. Click **Crop Mode: OFF** to toggle it **ON**.
2. A highlighted bounding box appears directly over the playing video surface.
3. Adjust the framing:
   - **X Offset Slider**: Move the crop box horizontally across the video frame.
   - **Y Offset Slider**: Move the crop box vertically across the video frame.
   - **Direct Input**: Type custom dimensions in the `W:H:X:Y` field (e.g., `1280:720:100:50`).
4. All crop values are automatically validated against the source resolution and rounded to even integers to prevent chroma subsampling errors during encoding.

### Workflow 3: Exporting Your Video

You have two choices for encoding:

#### Option A: Direct In-App Export

1. Click **Set Output Dir** to select a target export folder on your Mac (defaults to the source video's folder if unset).
2. Click **Run FFmpeg**.
3. A live progress bar and percentage indicator track encoding progress in real time.
4. When finished, a confirmation notification displays the saved file path.

#### Option B: Clipboard / Terminal Command

1. Click **Show Command**.
2. A drawer reveals the complete, production-ready FFmpeg command with all trimming, cropping, colorimetry, and encoding flags applied:

```bash
ffmpeg -ss 00:01:24.500 -to 00:01:48.200 -i "/Volumes/Media/Sample.mkv" \
  -vf "crop=1280:720:320:180" \
  -c:v libx264 -crf 17 -preset fast \
  -c:a aac -ac 2 \
  -map_metadata -1 -map_chapters -1 -movflags +faststart \
  "/Volumes/Media/clip.mp4" && echo "/Volumes/Media/clip.mp4"
```

3. Copy and run it in any terminal window.

---

## FFmpeg Configuration & Provisioning

`pureIINA` requires an accessible `ffmpeg` executable.

1. Open the collapsible **FFmpeg Settings** section in the sidebar.
2. If FFmpeg is already installed on your Mac, click **Find ffmpeg**. The plugin will search:
   - Homebrew (`/opt/homebrew/bin/ffmpeg` or `/usr/local/bin/ffmpeg`)
   - MacPorts (`/opt/local/bin/ffmpeg`)
   - Conda environments (`$HOME/miniconda3/...`)
   - Custom user directories (`$HOME/.local/bin`)
3. If no installation is detected, click **Download ffmpeg**. The plugin will download the official static macOS binary from `evermeet.cx`, extract it to the plugin's sandboxed storage (`@data/bin/ffmpeg`), configure executable permissions, and activate it automatically.

---

## Development

To modify or extend `pureIINA`:

```bash
# Clean and build all distribution assets
yarn build

# Run Parcel development servers for live webview inspection
yarn serve-sidebar
yarn serve-overlay
```

---

## Documentation & Internal Architecture

For deep architectural details, data flow diagrams, IPC contracts, and engineering guardrails:

- 📖 **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**: Exhaustive technical manual detailing subsystem architecture, dual-webview IPC mechanics, coordinate transformation formulas, and failure modes.
- 🛡️ **[`AGENTS.md`](./AGENTS.md)**: Master engineering invariants and guardrails for coding assistants and developers.

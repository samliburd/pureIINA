# Features

pureIINA consists of several interlinked features designed to make video clipping and cropping seamless.

## 1. Visual Crop Selection
Using the `iina.overlay` API, pureIINA injects an interactive HTML overlay on top of the playing video. 
- **Two-Click Cropping:** Users click once to set the top-left corner and click again to set the bottom-right corner of their desired crop area.
- **Real-Time Coordinates:** The overlay displays real-time normalized and absolute coordinates of the crop selection.
- **Crop Editing:** Users can manually edit the crop dimensions via a prompt if they require precise pixel-perfect dimensions.

## 2. Time Trimming
pureIINA captures the exact playback time in IINA. Users can set the current playback position as either the **Start Time** or the **End Time** for their clip.

## 3. FFmpeg Command Generation
Once the crop and trim parameters are set, pureIINA constructs a complete, optimized FFmpeg command. 
- The generated command uses `libx264` for video encoding, `aac` for audio, and applies the `crop` video filter based on the visual selection.
- Allows copying the command directly to the macOS clipboard.

## 4. Direct FFmpeg Execution
Instead of copying the command to a terminal, users can choose to execute the FFmpeg command directly through IINA. The plugin utilizes the `iina.utils.exec` API to run FFmpeg as a background process, automatically outputting the processed video to a designated directory.

## 5. FFmpeg Bootstrapping
If a user does not have FFmpeg installed, pureIINA includes a bootstrap script (`helpers.js`). It will search common system paths (like `/opt/homebrew/bin/ffmpeg`) and, if not found, offer to download a static binary of FFmpeg, extract it, and save the path to the plugin's preferences.

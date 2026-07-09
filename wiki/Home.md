# pureIINA Wiki

Welcome to the pureIINA Wiki!

## What is pureIINA?
pureIINA is a plugin for the [IINA](https://iina.io/) video player for macOS. It extends IINA's capabilities by providing a visual interface to trim and crop videos directly within the player, and then generate or execute an FFmpeg command to process the video. 

This is incredibly useful for users who want to quickly extract a specific scene or crop a portion of a video without needing to use a heavy video editing suite or manually guess crop coordinates for FFmpeg.

## Core Capabilities
- **Time Trimming:** Set precise start and end times for the video segment you wish to extract.
- **Visual Cropping:** Interactively draw a crop rectangle directly over the video using an interactive overlay.
- **FFmpeg Integration:** Automatically build the correct FFmpeg command with the selected times and crop dimensions. You can copy this command to your clipboard or run it directly within IINA.
- **Automatic Dependency Management:** If FFmpeg is not installed on the system, pureIINA can automatically download and configure a local copy of FFmpeg to use.

## Navigation
- [Features](Features.md) - Detailed breakdown of what pureIINA can do.
- [Usage Guide](Usage.md) - How to use the plugin and its keyboard shortcuts.
- [Architecture](Architecture.md) - Understanding the codebase.
- [Improvements & Tidying Up](Improvements.md) - Known issues, technical debt, and ideas for tidying up the codebase.

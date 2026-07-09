# Usage Guide

Once pureIINA is installed in IINA, it can be controlled entirely through keyboard shortcuts or via the IINA Menu bar (`Plugin` -> `pureIINA`).

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `c` | **Start/Complete Crop** | Activates the crop mode for the second click to complete the rectangle. |
| `Option + c` | **Cancel Crop** | Clears the current crop selection and resets the overlay. |
| `h` | **Toggle Overlay Info** | Hides or shows the informational text on the overlay. |
| `Option + k` | **Copy Command** | Generates the FFmpeg command and copies it to your clipboard. |
| `u` | **Set Start Time** | Sets the current video position as the start time for the cut. |
| `Cmd + u` | **Set End Time** | Sets the current video position as the end time for the cut. |
| `Shift + Cmd + u`| **Set Output Filename**| Prompts the user to set a custom output file name. |
| `Cmd + t` | **Toggle Crop** | Enables or disables the crop filter from being included in the final FFmpeg command. |
| `Cmd + e` | **Edit Crop** | Manually enter precise crop coordinates (width:height:x:y). |
| `Shift + Cmd + r`| **Run FFmpeg** | Directly executes the FFmpeg encoding process. |

## Menu Options
All shortcuts above have equivalent entries in the IINA top menu. 
Additionally, under the **FFMPEG** sub-menu, you can:
- **Initialise ffmpeg:** Triggers the setup wizard to locate or download FFmpeg.
- **Download ffmpeg:** Force a download of the FFmpeg binary.
- **Show ffmpeg path:** Displays the currently configured path to the FFmpeg executable.
- **Show command:** Prints the current FFmpeg command to the OSD (On-Screen Display).

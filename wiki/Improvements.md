# Improvements & Tidying Up

While pureIINA is functional, the codebase has several areas that could be tidied up or improved for better maintainability and user experience.

## Codebase Tidying Up
1. **Remove Dead Code & Stubs:**
   - `src/global.js` does nothing other than log a string. Since this plugin is tightly coupled to individual video windows, the global entry could be removed entirely from `Info.json` and deleted to reduce overhead.
   - `ui/window/` contains an unused HTML interface. If a standalone settings/status window isn't planned, this should be deleted.
   - Commented-out code (like the `listFiles` playlist function in `src/index.js`) should be removed to keep the source clean.
2. **Code Formatting:**
   - The project has `prettier` in its `devDependencies`, but some files have inconsistent formatting. Running `npm run prettier --write .` (or equivalent) across the `src` and `ui` directories will normalize styling.

## Feature Improvements
1. **FFmpeg Setup Flow:**
   - The FFmpeg initialization (`helpers.initFFMPEG`) has a slight flaw where it prompts the user but stores the result in an unused variable (due to an empty block for the help text: `const helpText = utils.ask(...)`). This flow could be made more robust with clearer error handling and dialogs.
2. **Progress Reporting:**
   - When running FFmpeg directly (`Shift + Cmd + r`), the user receives no feedback until the process finishes. Using FFmpeg's `-progress` flag or parsing `stderr` chunks to update a progress bar in the OSD or Overlay would greatly improve UX.
3. **Crop Interaction:**
   - The current two-click crop mechanism works, but a click-and-drag (marquee) selection would feel much more native and intuitive to users.
4. **Preference Page:**
   - pureIINA currently uses `pref.html` (declared in `Info.json`) to allow users to set preferences, but if it is unstyled or missing logic, it should be updated to adhere to standard IINA preference patterns. Implementing a proper preference page to let users define default output directories and FFmpeg codecs would be a great addition.

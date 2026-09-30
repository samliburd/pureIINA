# Architecture: IINA Tools Plugin

This document outlines the architecture for the new IINA Tools plugin and provides historical context regarding the legacy `pureiina` project to prevent recurring issues. Please update this document whenever major features, structural changes, or core architectural decisions are made.

## Context: The `pureiina` Legacy

The `pureiina` directory contains an older version of this plugin. While feature-rich (e.g., cropping, FFmpeg command generation, UI overlay), it frequently caused IINA to crash or freeze.

### Root Causes of Legacy Crashes
1. **Heavy Polling (`setInterval`)**: The old architecture heavily relied on `setInterval` (running every 500ms) to sync the video state, track info, and UI overlay.
2. **Expensive MPV Property Reads**: Within these intervals, it repeatedly called `mpv.getNative<Record<string, any>>("video-params")` and other heavy property getters. These operations are not meant to be polled aggressively and can lead to thread exhaustion or memory leaks.
3. **IPC Flooding**: Constantly spamming `overlay.postMessage` and `sidebar.postMessage` to sync state between the plugin core and the WebViews resulted in IPC bottlenecks.

## New Architecture Principles

To build a robust and performant plugin from the ground up, follow these core principles:

### 1. Event-Driven Over Polling
Instead of `setInterval`, use IINA's built-in event system (`event.on`) to listen for state changes. Examples include observing property changes or listening for explicit `iina.window-resized` events. 

### 2. Caching & Throttling
- **Cache Static Data**: Video track information (codecs, HDR status, dimensions) rarely changes during playback. Fetch this once when a new file is loaded, rather than continuously polling.
- **Throttle IPC Messages**: When sending messages to `sidebar` or `overlay`, throttle or debounce the calls to ensure we do not overload the IPC bridge.

### 3. Separation of Concerns
Keep the core logic (IINA API interaction, FFmpeg execution) decoupled from the UI logic. 
- **Core**: Handles `iina` API wrappers, state management, and file operations.
- **IPC Handler**: Centralized place to handle incoming messages from WebViews and broadcast state changes.
- **UI**: The React/Web UI should ideally maintain its own local state and only rely on the plugin core for actual side effects or initial data hydration.

### 4. Type Safety
The project uses TypeScript definitions specifically made for the IINA Plugin API. These are located in `iina-plugin-definition/iina/index.d.ts`. Ensure all `iina.*` calls adhere strictly to these types to prevent runtime errors.

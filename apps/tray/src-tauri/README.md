# StackSpend Tray Tauri Scaffold

This directory is a minimal scaffold for the future Tauri tray shell.

The TypeScript package already defines the local API client, action model, and notification suppression model. Native integration still needs:

- tray icon and menu binding;
- toast permission checks and delivery;
- click handling into local dashboard URLs;
- start-at-login preference wiring;
- unsigned development bundles;
- signed release packaging documentation.

Tauri dependencies are intentionally not added in this skeleton slice.

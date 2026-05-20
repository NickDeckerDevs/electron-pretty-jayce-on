---
name: run-json-prettifier
description: Build and package the JSON Prettifier Electron app for distribution on the current platform (Windows/macOS)
---

# JSON Prettifier — Build & Package

This skill builds and packages the JSON Prettifier Electron app for distribution on your current platform using electron-forge. On macOS it creates a `.dmg` installer; on Windows it creates an `.exe` installer.

## Prerequisites

**macOS:**
```bash
# Xcode Command Line Tools (required for building)
xcode-select --install
```

**Windows:**
```bash
# Visual Studio Build Tools or a full Visual Studio installation with C++ support
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

## Build

Install dependencies first:
```bash
npm install
```

Build and package for your current platform:
```bash
npm run build
```

The script auto-detects your OS and runs the appropriate builder:
- **macOS:** Creates `out/make/JSON Prettifier-1.0.0-arm64.dmg`
- **Windows:** Creates `.exe` installer in `out/make/`

To explicitly build for a specific platform:
```bash
npm run build:mac    # Build for macOS only
npm run build:win    # Build for Windows only
```

## Build Output

After a successful build, the installer/DMG is in `out/make/`. For example:

```bash
# On macOS:
ls -lh out/make/*.dmg

# On Windows:
ls out/make/*.exe
```

The installer is ready to distribute. Users can run it to install the JSON Prettifier application.

## Run (Human Path)

To run the app locally without building:
```bash
npm start
```

This launches the app in development mode. Press Ctrl+C to quit.

## Testing the Build

To verify the packaged app works, mount/install the distributable:

**macOS:**
```bash
# Mount the DMG
open out/make/JSON\ Prettifier-*.dmg
```

**Windows:**
```bash
# Run the installer
.\out\make\JSONPrettifier-*.exe
```

The app should launch and display the JSON Prettifier interface with all features intact (editor, prettify button, save, theme toggle, etc.).

## Gotchas

- **Slow first build:** The first build is slower because electron-forge packages the entire Electron binary. Subsequent builds are faster.
- **Windows code signing not configured:** The current build is unsigned. For distribution, you'll need to sign with a code signing certificate (configure in `forge.config.js` under `certificateFile` and `certificatePassword`).
- **macOS notarization not configured:** For distribution on macOS, Apple requires notarization. See `forge.config.js` comments for setup.
- **Large file size:** The packaged app is ~200-300 MB because it includes the full Electron runtime and all dependencies. This is normal for Electron apps.
- **Icon file required:** The build uses `icon.png` as the app icon. If missing, the build may use the default Electron icon.

## Troubleshooting

**"Could not find any Electron packages in devDependencies"**
- Ensure `electron` is in `devDependencies` in `package.json`, not `dependencies`.
- Run `npm install` to ensure all packages are installed.

**"NSIS installer failed" (Windows)**
- NSIS (Nullsoft Scriptable Install System) is required. electron-forge downloads it automatically, but if it fails:
  - Check your internet connection
  - Manually download NSIS from https://nsis.sourceforge.io/
  - Ensure Visual Studio Build Tools are installed

**"No code signing certificate" (Windows)**
- The build succeeds but produces an unsigned executable. For production, add a code signing certificate to `forge.config.js`.

**"dmg creation failed" (macOS)**
- Ensure you have write access to the `out/` directory
- Free up disk space (the build needs ~1 GB temporary space)
- Try deleting `out/` and rebuilding: `rm -rf out && npm run build`

**Build hangs during "Preparing native dependencies"**
- This step can take 2-5 minutes on first build. Wait; it's not frozen.
- If it hangs for >10 minutes, cancel and check console output.

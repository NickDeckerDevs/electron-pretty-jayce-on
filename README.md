# JSON Prettifier

A lightweight, standalone JSON formatting and exploration tool built with Electron. Clean, ad-free, and fully offline — no server, no network calls.

## Features

- **Prettify** — format and validate JSON with customizable indentation (2 spaces, 4 spaces, or tabs); auto-fixes JS-object-style input (unquoted keys, single quotes, trailing commas)
- **Tree view** with expand-all / collapse-all controls
- **Sort properties** alphabetically across the entire tree
- **Unescape nested JSON strings** — turns embedded JSON-as-string into real nested objects
- **Saved history** — save documents with titles + tags, sidebar list, load/delete
- **Custom Monaco themes** — theme editor with color pickers, save/apply/clear, persisted between sessions
- **JSON path** display follows your cursor: full path, breadcrumb chips for navigation, "Copy Path" with a configurable variable name
- **Array accessor chips** — when the cursor sits on an array item, get one-click copies for `find`, `filter`, `indexOf`, `includes`, `map`, `findIndex` access patterns
- **Dark / light mode** with persistent preference
- **Find / replace** powered by Monaco's native widget
- Syntax highlighting via Monaco Editor (same engine as VS Code), loaded locally from `node_modules`

## Screenshots

*Coming soon*

## Installation & Running

This is an Electron desktop app. Persistence uses the browser's `localStorage` — no server required.

1. **Download the code**:
   - Clone this repository or download the ZIP file

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Run in development**:
   ```
   npm start
   ```

4. **Build a distributable**:
   ```
   npm run build
   ```
   Produces a `.dmg` (macOS) or `.exe` (Windows) via electron-builder.

## Troubleshooting

### Common Issues with Electron

1. **Missing Dependencies on Linux**:
   - Electron requires several system libraries to run properly. If you encounter errors like:
     ```
     error while loading shared libraries: libnss3.so: cannot open shared object file
     ```
   - Install the required dependencies:
     - On Ubuntu/Debian:
       ```
       sudo apt-get install libnss3 libgdk-pixbuf2.0-0 libgtk-3-0 libxss1 libasound2
       ```
     - On Fedora/CentOS:
       ```
       sudo dnf install nss gtk3 libXScrnSaver alsa-lib
       ```

2. **Permission Errors on macOS**:
   - If you see "app is damaged and can't be opened" on macOS:
     ```
     xattr -cr /path/to/your/app.app
     ```

3. **Blank Screen or App Not Loading**:
   - This could be due to a version mismatch or incorrect file paths
   - Check your console for errors (View → Developer → Developer Tools in the app)
   - Ensure all file paths in main.js are correct relative to your working directory

## Planned Features

- Export options (save to file, export as different formats)
- Schema-aware validation
- Diff view between two JSON documents

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

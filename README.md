# JSON Prettifier

A lightweight, standalone JSON formatting tool built with Electron and also available as a web application. This tool provides a clean, ad-free interface for formatting and exploring JSON data.

## Features

- Format and validate JSON with customizable indentation (2 spaces, 4 spaces, or tabs)
- Syntax highlighting powered by Monaco Editor (same engine as VS Code)
- Dark and light mode themes
- JSON path display shows the path to your cursor position
- Error detection and helpful error messages
- Copy formatted JSON to clipboard
- Works as both a desktop application and a web application

## Screenshots

*Coming soon*

## Installation & Running

### Option 1: Running as a Web Application

1. **Download the code**:
   - Clone this repository or download the ZIP file
   - Extract to a folder on your local machine

2. **Install dependencies**:
   ```
   npm install express
   ```

3. **Start the web server**:
   ```
   node server.js
   ```

4. **Access the application**:
   - Open your web browser and navigate to: `http://localhost:5000`

### Option 2: Running as an Electron Desktop Application

1. **Download the code** as described above

2. **Install dependencies**:
   ```
   npm install electron@latest
   ```

3. **Run the Electron app**:
   - Directly with npx:
     ```
     npx electron .
     ```
   - Or add to package.json scripts and run with npm:
     ```json
     "scripts": {
       "start": "electron ."
     }
     ```
     Then run:
     ```
     npm start
     ```

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

### Web Application Issues

1. **Port Already in Use**:
   - If port 5000 is already in use, modify the port in server.js:
     ```javascript
     const port = process.env.PORT || 3000; // Change to any available port
     ```

2. **CORS Issues**:
   - If integrating with other services, you might encounter CORS errors
   - Add appropriate CORS headers in server.js:
     ```javascript
     app.use((req, res, next) => {
       res.header('Access-Control-Allow-Origin', '*');
       res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
       next();
     });
     ```

3. **Monaco Editor Not Loading**:
   - If the editor doesn't load, it could be due to network issues accessing CDN resources
   - Consider installing monaco-editor locally:
     ```
     npm install monaco-editor
     ```
   - Then update the path in HTML files to use the local version

## Planned Features

- Collapsible JSON nodes for easier navigation of large structures
- Ability to sort keys alphabetically at different levels
- Enhanced breadcrumb navigation showing the full JSON path
- Export options (save to file, export as different formats)
- More editor themes
- Search and replace functionality
- Tabs and spaces configuration

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

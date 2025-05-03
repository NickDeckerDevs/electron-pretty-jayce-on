const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Serve static files
app.use(express.static(path.join(__dirname, '/')));

// JSON prettify API endpoint
app.post('/api/prettify', express.json(), (req, res) => {
  try {
    const rawJson = req.body.json;
    const indentation = req.body.indentation || 2;
    
    // Parse and stringify to format the JSON
    const parsed = JSON.parse(rawJson);
    const formatted = JSON.stringify(parsed, null, indentation);
    
    res.json({ success: true, formatted });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Serve web-index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-index.html'));
});

// Serve files for specific routes
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`JSON Prettifier server running at http://0.0.0.0:${port}`);
});

const express = require('express');
const path = require('path');
const { storage } = require('./server/storage');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 5000;

// For parsing application/json
app.use(express.json());

// Session middleware (simplified for this example)
app.use((req, res, next) => {
  if (!req.headers.authorization) {
    // Generate a session ID if none exists
    const sessionId = crypto.randomUUID();
    req.userId = sessionId;
  } else {
    req.userId = req.headers.authorization;
  }
  next();
});

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

// User preferences API
app.get('/api/preferences', async (req, res) => {
  try {
    const preferences = await storage.getUserPreferences(req.userId);
    res.json({ success: true, preferences: preferences || { theme: 'light', indentation: 2, useSpaces: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/preferences', async (req, res) => {
  try {
    const preferences = await storage.createOrUpdateUserPreferences(req.userId, req.body);
    res.json({ success: true, preferences });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Themes API
app.get('/api/themes', async (req, res) => {
  try {
    const themes = await storage.getThemes(req.userId);
    res.json({ success: true, themes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/themes', async (req, res) => {
  try {
    const theme = await storage.saveTheme(req.userId, req.body);
    res.json({ success: true, theme });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/themes/:id', async (req, res) => {
  try {
    await storage.deleteTheme(req.params.id, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Saved documents API
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await storage.getSavedDocuments(req.userId);
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const document = await storage.getSavedDocumentById(req.params.id, req.userId);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/documents', async (req, res) => {
  try {
    const document = await storage.saveDocument(req.userId, req.body);
    res.json({ success: true, document });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    await storage.deleteDocument(req.params.id, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`JSON Prettifier server running at http://0.0.0.0:${port}`);
});

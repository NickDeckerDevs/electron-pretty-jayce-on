/*
5/1/2026 - nick decker
ADDED
- New localStorage persistence layer replacing the Express/PostgreSQL server API
- CRUD operations for documents: getDocuments, getDocument, saveDocument, deleteDocument
- CRUD operations for custom themes: getThemes, saveTheme, deleteTheme
- Preference persistence: getPreferences, savePreferences
- Auto-generates UUIDs and ISO timestamps (createdAt, updatedAt) on new records
*/
const Storage = (() => {
  const get = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  return {
    async getPreferences() {
      return { success: true, preferences: get('preferences', null) };
    },

    async savePreferences(data) {
      const prefs = { ...get('preferences', {}), ...data };
      set('preferences', prefs);
      return { success: true, preferences: prefs };
    },

    async getThemes() {
      return { success: true, themes: get('themes', []) };
    },

    async saveTheme(theme) {
      const themes = get('themes', []);
      const now = new Date().toISOString();
      const idx = themes.findIndex(t => t.id === theme.id);
      if (idx >= 0) {
        themes[idx] = { ...themes[idx], ...theme, updatedAt: now };
      } else {
        themes.push({ ...theme, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      }
      set('themes', themes);
      const saved = idx >= 0 ? themes[idx] : themes[themes.length - 1];
      return { success: true, theme: saved };
    },

    async deleteTheme(id) {
      set('themes', get('themes', []).filter(t => t.id !== id));
      return { success: true };
    },

    async getDocuments() {
      return { success: true, documents: get('documents', []) };
    },

    async getDocument(id) {
      const doc = get('documents', []).find(d => d.id === id);
      return { success: !!doc, document: doc || null };
    },

    async saveDocument(doc) {
      const docs = get('documents', []);
      const now = new Date().toISOString();
      const idx = docs.findIndex(d => d.id === doc.id);
      if (idx >= 0) {
        docs[idx] = { ...docs[idx], ...doc, updatedAt: now };
      } else {
        docs.push({ ...doc, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      }
      set('documents', docs);
      const saved = idx >= 0 ? docs[idx] : docs[docs.length - 1];
      return { success: true, document: saved };
    },

    async deleteDocument(id) {
      set('documents', get('documents', []).filter(d => d.id !== id));
      return { success: true };
    },
  };
})();

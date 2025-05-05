const { db } = require('./db');
const { userPreferences, savedDocuments, themes } = require('../shared/schema');
const { eq, and } = require('drizzle-orm');

class Storage {
  // User preferences
  async getUserPreferences(userId) {
    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return preferences;
  }

  async createOrUpdateUserPreferences(userId, data) {
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    data.updatedAt = new Date();

    if (existing) {
      const [updated] = await db
        .update(userPreferences)
        .set(data)
        .where(eq(userPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      data.userId = userId;
      data.createdAt = new Date();
      const [created] = await db
        .insert(userPreferences)
        .values(data)
        .returning();
      return created;
    }
  }

  // Saved documents
  async getSavedDocuments(userId) {
    return await db
      .select()
      .from(savedDocuments)
      .where(eq(savedDocuments.userId, userId))
      .orderBy(savedDocuments.updatedAt);
  }

  async getSavedDocumentById(id, userId) {
    const [document] = await db
      .select()
      .from(savedDocuments)
      .where(
        and(
          eq(savedDocuments.id, id),
          eq(savedDocuments.userId, userId)
        )
      );
    return document;
  }

  async saveDocument(userId, document) {
    document.userId = userId;
    document.updatedAt = new Date();

    if (document.id) {
      const [updated] = await db
        .update(savedDocuments)
        .set(document)
        .where(
          and(
            eq(savedDocuments.id, document.id),
            eq(savedDocuments.userId, userId)
          )
        )
        .returning();
      return updated;
    } else {
      document.createdAt = new Date();
      const [created] = await db
        .insert(savedDocuments)
        .values(document)
        .returning();
      return created;
    }
  }

  async deleteDocument(id, userId) {
    await db
      .delete(savedDocuments)
      .where(
        and(
          eq(savedDocuments.id, id),
          eq(savedDocuments.userId, userId)
        )
      );
  }

  // Themes
  async getThemes(userId) {
    return await db
      .select()
      .from(themes)
      .where(eq(themes.userId, userId));
  }

  async saveTheme(userId, theme) {
    theme.userId = userId;
    theme.updatedAt = new Date();

    if (theme.id) {
      const [updated] = await db
        .update(themes)
        .set(theme)
        .where(
          and(
            eq(themes.id, theme.id),
            eq(themes.userId, userId)
          )
        )
        .returning();
      return updated;
    } else {
      theme.createdAt = new Date();
      const [created] = await db
        .insert(themes)
        .values(theme)
        .returning();
      return created;
    }
  }

  async deleteTheme(id, userId) {
    await db
      .delete(themes)
      .where(
        and(
          eq(themes.id, id),
          eq(themes.userId, userId)
        )
      );
  }
}

exports.storage = new Storage();

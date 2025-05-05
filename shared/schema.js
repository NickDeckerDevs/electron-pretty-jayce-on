// Database schema definition
const { pgTable, serial, text, integer, boolean, json, timestamp } = require('drizzle-orm/pg-core');

// User preferences table
exports.userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),  // Can be a session ID for anonymous users
  theme: text('theme').default('light'),  // light or dark
  indentation: integer('indentation').default(2),  // 2, 4, or -1 for tabs
  useSpaces: boolean('use_spaces').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Saved JSON documents table
exports.savedDocuments = pgTable('saved_documents', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  content: json('content').notNull(),
  tags: text('tags').array(),
  isFavorite: boolean('is_favorite').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Themes table for custom themes
exports.themes = pgTable('themes', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  isDefault: boolean('is_default').default(false),
  colors: json('colors').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

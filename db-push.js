const { Pool } = require('pg');
const { userPreferences, savedDocuments, themes } = require('./shared/schema');
const fs = require('fs');

async function createTables() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to the database');

    // Create tables
    console.log('Creating tables...');
    
    // User Preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        theme TEXT DEFAULT 'light',
        indentation INTEGER DEFAULT 2,
        use_spaces BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created user_preferences table');

    // Saved Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_documents (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content JSONB NOT NULL,
        tags TEXT[],
        is_favorite BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created saved_documents table');

    // Themes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS themes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        colors JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Created themes table');

    client.release();
    console.log('All tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await pool.end();
  }
}

createTables().catch(console.error);

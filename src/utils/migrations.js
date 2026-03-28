const db = require('./db');

/**
 * Crée la table users si elle n'existe pas
 */
async function createUsersTable() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        business_name VARCHAR(255),
        subscription_status VARCHAR(50) DEFAULT 'free',
        google_access_token VARCHAR(2048),
        google_refresh_token VARCHAR(2048),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await db.query(createTableQuery);
    console.log('[Migrations] ✓ Users table created or already exists');
  } catch (error) {
    console.error('[Migrations] ✗ Failed to create users table:', error.message);
    throw error;
  }
}

/**
 * Ajoute les colonnes Google OAuth si elles n'existent pas
 */
async function addGoogleOAuthColumns() {
  try {
    // Ajouter google_access_token
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_access_token VARCHAR(2048);
    `);

    // Ajouter google_refresh_token
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR(2048);
    `);

    console.log('[Migrations] ✓ Google OAuth columns added or already exist');
  } catch (error) {
    console.error('[Migrations] ✗ Failed to add Google OAuth columns:', error.message);
    throw error;
  }
}

/**
 * Exécute toutes les migrations
 * À appeler au démarrage de l'application
 */
async function runMigrations() {
  try {
    console.log('[Migrations] Starting migrations...');

    // Vérifier la connexion dabord
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to database');
    }

    // Créer les tables
    await createUsersTable();

    // Ajouter les colonnes Google OAuth
    await addGoogleOAuthColumns();

    console.log('[Migrations] ✓ All migrations completed successfully');
    return true;
  } catch (error) {
    console.error('[Migrations] ✗ Migration failed:', error.message);
    throw error;
  }
}

module.exports = {
  runMigrations,
};

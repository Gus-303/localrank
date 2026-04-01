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
 * Ajoute la colonne plan dans users si elle n'existe pas
 */
async function addPlanColumn() {
  try {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
    `);
    console.log('[Migrations] ✓ Plan column added or already exists');
  } catch (error) {
    console.error('[Migrations] ✗ Failed to add plan column:', error.message);
    throw error;
  }
}

/**
 * Crée la table establishments si elle n'existe pas
 */
async function createEstablishmentsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS establishments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        google_account_id VARCHAR(255),
        google_location_id VARCHAR(255),
        google_access_token TEXT,
        google_refresh_token TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[Migrations] ✓ Establishments table created or already exists');
  } catch (error) {
    console.error('[Migrations] ✗ Failed to create establishments table:', error.message);
    throw error;
  }
}

/**
 * Crée la table reviews si elle n'existe pas
 */
async function createReviewsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        establishment_id INTEGER REFERENCES establishments(id) ON DELETE CASCADE,
        author VARCHAR(255),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        ai_response TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[Migrations] ✓ Reviews table created or already exists');
  } catch (error) {
    console.error('[Migrations] ✗ Failed to create reviews table:', error.message);
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

    // Ajouter la colonne plan
    await addPlanColumn();

    // Créer la table establishments
    await createEstablishmentsTable();

    // Créer la table reviews
    await createReviewsTable();

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

require('dotenv').config({ override: false });

console.log('[DB URL]', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NON DÉFINIE');

const { Pool } = require('pg');

// Vérifier que DATABASE_URL est configurée
if (!process.env.DATABASE_URL) {
  throw new Error(
    '[Database] DATABASE_URL not found in environment variables. ' +
    'Add it to .env file: DATABASE_URL=postgresql://user:password@localhost:5432/localrank'
  );
}

// Créer le pool de connexions PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Nombre max de connexions simultanées
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Gérer les erreurs de connexion
pool.on('error', (error) => {
  console.error('[Database] Pool error:', error.message);
  // Ne pas lancer pour ne pas tuer l'app complètement, mais logger
});

/**
 * Exécute une requête SQL
 * @param {string} text - La requête SQL
 * @param {array} params - Les paramètres (pour éviter les injections SQL)
 * @returns {Promise<object>} Résultat de la requête
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[Database Query]', { duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('[Database Error]', {
      message: error.message,
      query: text.slice(0, 100), // Afficher que les 100 premiers chars de la query
      // Ne PAS afficher les paramètres (peuvent contenir des données sensibles)
    });
    throw error;
  }
}

/**
 * Exécute une requête et retourne la première ligne
 * @param {string} text - La requête SQL
 * @param {array} params - Les paramètres
 * @returns {Promise<object|null>}
 */
async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Exécute une requête et retourne toutes les lignes
 * @param {string} text - La requête SQL
 * @param {array} params - Les paramètres
 * @returns {Promise<array>}
 */
async function queryAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Teste la connexion à la base de données
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('[Database] ✓ PostgreSQL connection successful');
    return true;
  } catch (error) {
    console.error('[Database] ✗ PostgreSQL connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  queryAll,
  testConnection,
};

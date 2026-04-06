const bcrypt = require('bcryptjs');
const db = require('../utils/db');

class User {
  constructor({ id, email, password, businessName, createdAt, subscriptionStatus }) {
    this.id = id;
    this.email = email;
    this.password = password; // hash stocké
    this.businessName = businessName;
    this.createdAt = createdAt;
    this.subscriptionStatus = subscriptionStatus || 'free';
  }

  /**
   * Compare un password en clair avec le hash stocké
   * @param {string} plainPassword - mot de passe en clair
   * @returns {Promise<boolean>}
   */
  async comparePassword(plainPassword) {
    try {
      return await bcrypt.compare(plainPassword, this.password);
    } catch (error) {
      console.error('[User.comparePassword] Error:', error.message);
      return false;
    }
  }

  /**
   * Retourne l'utilisateur sans le password
   */
  toJSON() {
    const { password, ...rest } = Object.assign({}, this);
    return rest;
  }

  /**
   * Recherche un utilisateur par email dans PostgreSQL
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  static async findByEmail(email) {
    try {
      const result = await db.queryOne(
        'SELECT id, email, password, business_name, subscription_status, created_at FROM users WHERE email = $1',
        [email]
      );

      if (!result) {
        return null;
      }

      return new User({
        id: result.id,
        email: result.email,
        password: result.password,
        businessName: result.business_name,
        subscriptionStatus: result.subscription_status,
        createdAt: result.created_at,
      });
    } catch (error) {
      console.error('[User.findByEmail] Error:', error.message);
      throw error;
    }
  }

  /**
   * Recherche un utilisateur par ID dans PostgreSQL
   * @param {number} id
   * @returns {Promise<User|null>}
   */
  static async findById(id) {
    try {
      const result = await db.queryOne(
        'SELECT id, email, password, business_name, subscription_status, created_at FROM users WHERE id = $1',
        [id]
      );

      if (!result) {
        return null;
      }

      return new User({
        id: result.id,
        email: result.email,
        password: result.password,
        businessName: result.business_name,
        subscriptionStatus: result.subscription_status,
        createdAt: result.created_at,
      });
    } catch (error) {
      console.error('[User.findById] Error:', error.message);
      throw error;
    }
  }

  /**
   * Crée un nouvel utilisateur dans PostgreSQL
   * Hash le mot de passe avant de sauvegarder
   * @param {string} email
   * @param {string} plainPassword - mot de passe en clair
   * @param {string} businessName
   * @returns {Promise<User>}
   */
  static async create(email, plainPassword, businessName) {
    try {
      // Hash le password
      const salt = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, salt);

      const rawResult = await db.query(
        'INSERT INTO users (email, password, business_name, subscription_status) VALUES ($1, $2, $3, $4) RETURNING id, email, business_name, subscription_status, created_at',
        [email, hashedPassword, businessName, 'free']
      );

      console.log('[User.create] Résultat INSERT:', JSON.stringify(rawResult));
      console.log('[User.create] Rows affectées:', rawResult?.rowCount);
      console.log('[User.create] Données retournées:', rawResult?.rows);

      const result = rawResult?.rows?.[0];

      return new User({
        id: result.id,
        email: result.email,
        password: hashedPassword,
        businessName: result.business_name,
        subscriptionStatus: result.subscription_status,
        createdAt: result.created_at,
      });
    } catch (error) {
      if (error.code === '23505') {
        // Code d'erreur PostgreSQL pour UNIQUE violation
        const err = new Error('Email already exists');
        err.status = 400;
        throw err;
      }
      console.error('[User.create] Error:', error.message);
      throw error;
    }
  }
}

module.exports = User;

const bcrypt = require('bcrypt');

class User {
  constructor({ id, email, password, businessName, createdAt, subscriptionStatus }) {
    this.id = id;
    this.email = email;
    this.password = password; // hash stocké
    this.businessName = businessName;
    this.createdAt = createdAt || new Date();
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
}

module.exports = User;

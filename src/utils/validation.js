/**
 * Valide le format d'une adresse email
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valide la force du password
 * Minimum 8 caractères
 */
function isValidPassword(password) {
  return password && password.length >= 8;
}

module.exports = {
  isValidEmail,
  isValidPassword,
};

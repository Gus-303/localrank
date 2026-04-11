const PLAN_LIMITS = {
  free: 1,
  starter: 1,
  pro: 3,
};

/**
 * Vérifie si l'utilisateur peut ajouter un établissement selon son plan
 * @param {string} plan - Le plan de l'utilisateur
 * @param {number} currentCount - Le nombre d'établissements actuels
 * @returns {boolean}
 */
function canAddEstablishment(plan, currentCount) {
  const limit = PLAN_LIMITS[plan] || 0;
  return currentCount < limit;
}

module.exports = { PLAN_LIMITS, canAddEstablishment };

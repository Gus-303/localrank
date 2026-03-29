const PLAN_LIMITS = {
  free: 0,
  starter: 1,
  pro: 3,
  agency: 10,
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

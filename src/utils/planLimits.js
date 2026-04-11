const PLAN_LIMITS = {
  free: 1,
  starter: 3,
  pro: 10,
};

// Features disponibles par plan
const PLAN_FEATURES = {
  free:    { qrcode: false, alerts: false, competitors: false, campaigns: false },
  starter: { qrcode: true,  alerts: false, competitors: false, campaigns: false },
  pro:     { qrcode: true,  alerts: true,  competitors: true,  campaigns: true  },
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

/**
 * Vérifie si un plan a accès à une feature
 * @param {string} plan - Le plan de l'utilisateur
 * @param {string} feature - La feature à vérifier
 * @returns {boolean}
 */
function canAccessFeature(plan, feature) {
  return PLAN_FEATURES[plan]?.[feature] === true;
}

module.exports = { PLAN_LIMITS, PLAN_FEATURES, canAddEstablishment, canAccessFeature };

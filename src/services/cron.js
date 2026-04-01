const cron = require('node-cron');
const { queryAll } = require('../utils/db');
const { generateWeeklyPost } = require('./ai');
const { createPost } = require('./google');

/**
 * Publie un post Google pour un seul établissement.
 * Isolé dans sa propre fonction pour que les erreurs ne se propagent pas.
 * @param {object} establishment - Ligne de la table establishments
 * @returns {Promise<boolean>} true si succès, false si erreur
 */
async function publishPostForEstablishment(establishment) {
  const { id, name, type, google_access_token, google_account_id, google_location_id } = establishment;

  try {
    const postContent = await generateWeeklyPost(name, type);
    await createPost(google_access_token, google_account_id, google_location_id, postContent);
    console.log(`[CRON] ✓ Post publié - établissement #${id} "${name}"`);
    return true;
  } catch (error) {
    const message = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error(`[CRON] ✗ Échec établissement #${id} "${name}": ${message}`);
    return false;
  }
}

/**
 * Récupère les établissements éligibles (google_access_token non null)
 * @returns {Promise<Array>}
 */
async function getEligibleEstablishments() {
  return queryAll(
    `SELECT id, name, type, google_access_token, google_account_id, google_location_id
     FROM establishments
     WHERE google_access_token IS NOT NULL`,
    []
  );
}

/**
 * Job principal : génère et publie un post pour chaque établissement éligible.
 * Une erreur sur un établissement n'interrompt pas les autres.
 */
async function runWeeklyPostsJob() {
  console.log('[CRON] Démarrage du job posts hebdomadaires...');

  let establishments;
  try {
    establishments = await getEligibleEstablishments();
  } catch (error) {
    console.error('[CRON] ✗ Impossible de récupérer les établissements:', error.message);
    return;
  }

  if (establishments.length === 0) {
    console.log('[CRON] Aucun établissement éligible, job terminé.');
    return;
  }

  console.log(`[CRON] ${establishments.length} établissement(s) à traiter.`);

  const results = await Promise.allSettled(
    establishments.map((establishment) => publishPostForEstablishment(establishment))
  );

  const successes = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  const failures = results.length - successes;

  console.log(`[CRON] Terminé — ${successes} succès, ${failures} erreurs`);
}

/**
 * Initialise le cron job hebdomadaire.
 * Planifié chaque lundi à 9h00 (fuseau serveur).
 * À appeler une seule fois au démarrage du serveur.
 */
function initCron() {
  cron.schedule('0 9 * * 1', () => {
    runWeeklyPostsJob().catch((error) => {
      console.error('[CRON] ✗ Erreur inattendue dans runWeeklyPostsJob:', error.message);
    });
  });

  console.log('[CRON] ✓ Job posts hebdomadaires planifié (lundi 9h)');
}

module.exports = { initCron, runWeeklyPostsJob };

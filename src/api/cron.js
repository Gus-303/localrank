// TODO: Supprimer ce fichier après les tests - route de déclenchement manuel uniquement
const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { runWeeklyPostsJob } = require('../services/cron');

const router = express.Router();

// GET /api/cron/test-weekly-posts
// Déclenche manuellement le job de posts hebdomadaires (dev uniquement)
router.get('/test-weekly-posts', verifyToken, async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  try {
    await runWeeklyPostsJob();
    res.json({ success: true, message: 'Job lancé' });
  } catch (error) {
    console.error('[/api/cron/test-weekly-posts] Erreur:', error.message);
    res.status(500).json({ error: isProd ? 'Erreur lors de l\'exécution du job.' : error.message });
  }
});

module.exports = router;

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');
const aiService = require('../services/ai');

const router = express.Router();

/**
 * POST /api/posts/generate
 * Génère un post Google My Business via Anthropic pour l'utilisateur connecté.
 * Utilise le nom et le type du premier établissement disponible.
 * Retourne : { content: string }
 */
router.post('/generate', verifyToken, async (req, res) => {
  try {
    console.log('[Posts Generate] Demande de génération pour user:', req.user.id);

    // Récupérer le nom du commerce depuis la table users
    const userRow = await db.queryOne(
      'SELECT business_name FROM users WHERE id = $1',
      [req.user.id]
    );

    // Récupérer le premier établissement pour avoir le type
    const establishment = await db.queryOne(
      'SELECT name, type FROM establishments WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [req.user.id]
    );

    // Déterminer businessName et businessType avec fallbacks
    const businessName = (establishment?.name || userRow?.business_name || 'Mon commerce').trim();
    const businessType = (establishment?.type || 'Commerce').trim();

    console.log('[Posts Generate] businessName:', businessName, '— businessType:', businessType);

    const content = await aiService.generateWeeklyPost(businessName, businessType);

    console.log('[Posts Generate] ✓ Post généré, longueur:', content.length);

    res.json({ content });
  } catch (error) {
    const message = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error('[Posts Generate] Error:', message);

    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: isProd ? 'Erreur lors de la génération du post.' : message,
    });
  }
});

module.exports = router;

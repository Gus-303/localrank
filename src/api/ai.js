const express = require('express');
const { verifyToken } = require('../middleware/auth');
const aiService = require('../services/ai');

const router = express.Router();

/**
 * POST /api/ai/test-reply
 * Route de test pour vérifier que l'API Anthropic fonctionne
 * Génère une réponse à un avis Google
 * 
 * Body: {
 *   reviewText: string,
 *   businessName: string,
 *   businessType: string
 * }
 */
router.post('/test-reply', verifyToken, async (req, res) => {
  try {
    const { reviewText, businessName, businessType } = req.body;

    // Validation des inputs
    if (!reviewText || !reviewText.trim()) {
      return res.status(400).json({
        error: 'reviewText est requis et ne peut pas être vide',
      });
    }

    if (!businessName || !businessName.trim()) {
      return res.status(400).json({
        error: 'businessName est requis et ne peut pas être vide',
      });
    }

    if (!businessType || !businessType.trim()) {
      return res.status(400).json({
        error: 'businessType est requis et ne peut pas être vide',
      });
    }

    // Appeler le service IA
    const reply = await aiService.generateReviewReply(
      reviewText.trim(),
      businessName.trim(),
      businessType.trim()
    );

    console.log('[AI.testReply] ✓ Reply generated successfully for user:', req.user.id);

    res.json({
      success: true,
      reply,
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';

    console.error('[AI.testReply] Error:', error.message || error);

    res.status(500).json({
      success: false,
      error: isDev ? error.message || error : 'Erreur lors de la génération de la réponse',
    });
  }
});

/**
 * POST /api/ai/test-post
 * Route de test pour vérifier que l'API Anthropic fonctionne
 * Génère un post Google My Business hebdomadaire
 * 
 * Body: {
 *   businessName: string,
 *   businessType: string
 * }
 */
router.post('/test-post', verifyToken, async (req, res) => {
  try {
    const { businessName, businessType } = req.body;

    // Validation des inputs
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({
        error: 'businessName est requis et ne peut pas être vide',
      });
    }

    if (!businessType || !businessType.trim()) {
      return res.status(400).json({
        error: 'businessType est requis et ne peut pas être vide',
      });
    }

    // Appeler le service IA
    const post = await aiService.generateWeeklyPost(
      businessName.trim(),
      businessType.trim()
    );

    console.log('[AI.testPost] ✓ Post generated successfully for user:', req.user.id);

    res.json({
      success: true,
      post,
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';

    console.error('[AI.testPost] Error:', error.message || error);

    res.status(500).json({
      success: false,
      error: isDev ? error.message || error : 'Erreur lors de la génération du post',
    });
  }
});

module.exports = router;

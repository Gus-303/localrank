const express = require('express');
const { google } = require('googleapis');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');
const { detectCrisis } = require('../services/notifications');

const router = express.Router();

// Initialiser le client OAuth2 Google
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/google/callback`
);

/**
 * GET /api/google/auth
 * Génère l'URL d'autorisation Google OAuth et la retourne en JSON
 * Protégée : Authentification JWT requise
 * Retourne : { authUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }
 */
router.get('/auth', verifyToken, (req, res) => {
  try {
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.user.id, // Stocker l'ID utilisateur dans le state
    });

    console.log('[Google Auth] URL d\'autorisation générée pour user:', req.user.id);
    res.json({ authUrl: authorizationUrl });
  } catch (error) {
    console.error('[Google Auth] Error:', error.message);
    res.status(500).json({
      error: 'Erreur lors de l\'initialisation de l\'authentification Google.',
    });
  }
});

/**
 * GET /api/google/callback
 * Reçoit le code d'autorisation de Google et l'échange contre un access_token
 * Sauvegarde le token dans la table users
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state;

    if (!code || !userId) {
      return res.status(400).json({
        error: 'Code d\'autorisation ou ID utilisateur manquant.',
      });
    }

    // Échanger le code contre un access_token et refresh_token
    const { tokens } = await oauth2Client.getToken(code);

    console.log('[Google Auth Callback] Tokens reçus pour user:', userId);

    // Sauvegarder les tokens dans la base de données
    await db.query(
      `UPDATE users 
       SET google_access_token = $1, google_refresh_token = $2 
       WHERE id = $3`,
      [tokens.access_token, tokens.refresh_token || null, userId]
    );

    console.log('[Google Auth] ✓ Google access_token sauvegardé pour user:', userId);

    // Rediriger vers le dashboard
    res.redirect('/pages/dashboard.html');
  } catch (error) {
    console.error('[Google Auth Callback] Error:', error.message);
    res.status(500).json({
      error: 'Erreur lors de l\'échange du token Google.',
    });
  }
});

/**
 * GET /api/google/reviews
 * Récupère les avis Google du commerce connecté
 * Protégée : Authentification JWT requise
 * Retourne : Liste des avis avec auteur, note, texte, date
 */
router.get('/reviews', verifyToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur a un google_access_token en DB
    const userResult = await db.queryOne(
      'SELECT google_access_token FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult || !userResult.google_access_token) {
      return res.json({ connected: false });
    }

    // L'utilisateur est connecté — tenter de récupérer les avis
    try {
      oauth2Client.setCredentials({
        access_token: userResult.google_access_token,
      });

      console.log('[Google Reviews] Récupération des avis pour user:', req.user.id);

      // TODO: implémenter la récupération réelle des avis via Google Business Profiles API
      const reviews = [];

      // Déclencher la détection de crise en arrière-plan pour les avis ≤ 3 étoiles
      const hasLowRating = reviews.some(r => r.rating <= 3);
      if (hasLowRating) {
        const establishments = await db.queryAll(
          'SELECT id FROM establishments WHERE user_id = $1',
          [req.user.id]
        );
        for (const estab of establishments) {
          detectCrisis(estab.id).catch(err =>
            console.error('[Google Reviews] detectCrisis error:', err.message)
          );
        }
      }

      res.json({ connected: true, reviews });
    } catch (reviewError) {
      // La récupération des avis a échoué, mais le token existe : Google est connecté
      console.error('[Google Reviews] Erreur récupération avis:', reviewError.message);
      res.json({ connected: true, reviews: [] });
    }
  } catch (error) {
    console.error('[Google Reviews] Error:', error.message);
    res.status(500).json({
      error: 'Erreur lors de la vérification de la connexion Google.',
    });
  }
});

module.exports = router;

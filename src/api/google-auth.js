const express = require('express');
const { google } = require('googleapis');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');

const router = express.Router();

// Initialiser le client OAuth2 Google
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/google/callback`
);

/**
 * GET /api/google/auth
 * Génère l'URL d'autorisation Google OAuth et redirige vers Google
 * Protégée : Authentification JWT requise
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

    console.log('[Google Auth] Redirection vers Google OAuth pour user:', req.user.id);
    res.redirect(authorizationUrl);
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
    // Récupérer le token d'accès Google de l'utilisateur
    const userResult = await db.queryOne(
      'SELECT google_access_token FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!userResult || !userResult.google_access_token) {
      return res.status(403).json({
        error: 'Authentification Google requise. Veuillez d\'abord connecter votre compte Google.',
      });
    }

    // Configurer le client avec le token utilisateur
    oauth2Client.setCredentials({
      access_token: userResult.google_access_token,
    });

    // Instancier l'API Google Business Profiles
    const mybusiness = google.mybusiness({
      version: 'v4',
      auth: oauth2Client,
    });

    // Récupérer la liste des comptes
    // Note: Cette est une implémentation de base.
    // En production, il faudra gérer correctement le récupération du location ID
    console.log('[Google Reviews] Récupération des avis pour user:', req.user.id);

    // Retourner une structure temporaire (à implémenter avec l'API réelle)
    res.json({
      success: true,
      message: 'Intégration Google Business Profiles en cours de configuration',
      reviews: [],
      note: 'Consultez la documentation Google Business Profiles API pour implémenter la récupération complète des avis',
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';

    console.error('[Google Reviews] Error:', error.message);

    res.status(500).json({
      error: isDev ? error.message : 'Erreur lors de la récupération des avis Google.',
    });
  }
});

module.exports = router;

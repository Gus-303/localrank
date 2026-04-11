const jwt = require('jsonwebtoken');
const db = require('../utils/db');

/**
 * Middleware pour vérifier le JWT
 * Extrait l'utilisateur du token et l'ajoute au contexte de la requête
 * Bloque les utilisateurs free dont l'essai a expiré
 */
async function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token manquant. Authentification requise.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Vérifier si l'essai gratuit a expiré
    const row = await db.queryOne(
      'SELECT plan, trial_ends_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (row && row.plan === 'free' && row.trial_ends_at && new Date(row.trial_ends_at) < new Date()) {
      return res.status(403).json({
        error: 'Essai expiré',
        expired: true,
      });
    }

    next();
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';

    console.error('[verifyToken] Error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré.',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token invalide.',
      });
    }

    res.status(500).json({
      error: isDev ? error.message : 'Erreur serveur.',
    });
  }
}

module.exports = { verifyToken };

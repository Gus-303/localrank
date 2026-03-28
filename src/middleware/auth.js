const jwt = require('jsonwebtoken');

/**
 * Middleware pour vérifier le JWT
 * Extrait l'utilisateur du token et l'ajoute au contexte de la requête
 */
function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token manquant. Authentification requise.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
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

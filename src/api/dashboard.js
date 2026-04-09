const express = require('express');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');

const router = express.Router();

/**
 * Retourne les IDs d'établissements de l'utilisateur.
 * Retourne [] si aucun établissement.
 */
async function getEstablishmentIds(userId) {
  const rows = await db.queryAll(
    'SELECT id FROM establishments WHERE user_id = $1',
    [userId]
  );
  return rows.map(r => r.id);
}

/**
 * GET /api/dashboard/reviews
 * Retourne les avis depuis PostgreSQL pour tous les établissements de l'utilisateur.
 */
router.get('/reviews', verifyToken, async (req, res) => {
  try {
    const ids = await getEstablishmentIds(req.user.id);

    console.log('[Dashboard Reviews] user:', req.user.id, '— établissements:', ids);

    if (ids.length === 0) {
      return res.json([]);
    }

    const reviews = await db.queryAll(
      `SELECT
         id,
         author,
         rating,
         text,
         response_text  AS response,
         created_at     AS "publishedAt"
       FROM reviews
       WHERE establishment_id = ANY($1)
       ORDER BY created_at DESC
       LIMIT 50`,
      [ids]
    );

    console.log('[Dashboard Reviews] avis trouvés:', reviews.length);
    res.json(reviews);
  } catch (error) {
    console.error('[Dashboard Reviews] Error:', error.message);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: isProd ? 'Erreur lors du chargement des avis.' : error.message,
    });
  }
});

/**
 * GET /api/dashboard/score
 * Calcule la note moyenne et le nombre d'avis depuis PostgreSQL.
 */
router.get('/score', verifyToken, async (req, res) => {
  try {
    const ids = await getEstablishmentIds(req.user.id);

    console.log('[Dashboard Score] user:', req.user.id, '— établissements:', ids);

    if (ids.length === 0) {
      return res.json({ score: 0, reviewCount: 0 });
    }

    const row = await db.queryOne(
      `SELECT
         COUNT(*)::int           AS "reviewCount",
         COALESCE(AVG(rating), 0) AS score
       FROM reviews
       WHERE establishment_id = ANY($1)`,
      [ids]
    );

    console.log('[Dashboard Score] résultat:', row);
    res.json({
      score: parseFloat(parseFloat(row.score).toFixed(1)),
      reviewCount: row.reviewCount,
    });
  } catch (error) {
    console.error('[Dashboard Score] Error:', error.message);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: isProd ? 'Erreur lors du chargement du score.' : error.message,
    });
  }
});

/**
 * GET /api/dashboard/posts
 * Retourne les posts publiés depuis PostgreSQL pour tous les établissements de l'utilisateur.
 */
router.get('/posts', verifyToken, async (req, res) => {
  try {
    const ids = await getEstablishmentIds(req.user.id);

    console.log('[Dashboard Posts] user:', req.user.id, '— établissements:', ids);

    if (ids.length === 0) {
      return res.json([]);
    }

    const posts = await db.queryAll(
      `SELECT
         id,
         content,
         published_at AS "publishedAt",
         status
       FROM posts
       WHERE establishment_id = ANY($1)
       ORDER BY published_at DESC NULLS LAST
       LIMIT 50`,
      [ids]
    );

    console.log('[Dashboard Posts] posts trouvés:', posts.length);
    res.json(posts);
  } catch (error) {
    console.error('[Dashboard Posts] Error:', error.message);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({
      error: isProd ? 'Erreur lors du chargement des posts.' : error.message,
    });
  }
});

module.exports = router;

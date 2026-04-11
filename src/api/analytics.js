require('dotenv').config({ override: false });
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { verifyToken, checkPlanFeature } = require('../middleware/auth');
const db = require('../utils/db');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Retourne l'ID du premier établissement de l'utilisateur, ou null.
 */
async function getFirstEstablishmentId(userId) {
  const row = await db.queryOne(
    'SELECT id FROM establishments WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
    [userId]
  );
  return row ? row.id : null;
}

/**
 * Lit le cache en DB. Retourne null si absent, expiré ou si la table n'existe pas.
 */
async function getCache(establishmentId, type) {
  try {
    const row = await db.queryOne(
      `SELECT data FROM analytics_cache
       WHERE establishment_id = $1 AND type = $2 AND expires_at > NOW()`,
      [establishmentId, type]
    );
    return row ? row.data : null;
  } catch (err) {
    console.warn(`[Analytics Cache] getCache(${type}) échoué — table manquante ou erreur DB:`, err.message);
    return null;
  }
}

/**
 * Écrit (upsert) le cache en DB avec expiration 24h.
 * N'interrompt pas la requête principale si la table n'existe pas.
 */
async function setCache(establishmentId, type, data) {
  try {
    await db.query(
      `INSERT INTO analytics_cache (establishment_id, type, data, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       ON CONFLICT (establishment_id, type)
       DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`,
      [establishmentId, type, JSON.stringify(data)]
    );
  } catch (err) {
    console.warn(`[Analytics Cache] setCache(${type}) échoué — table manquante ou erreur DB:`, err.message);
  }
}

/**
 * Extrait le premier tableau JSON d'une réponse texte Anthropic.
 * Lève une erreur si aucun tableau valide trouvé.
 */
function parseJsonArray(text) {
  const match = text.trim().match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Aucun tableau JSON trouvé dans la réponse IA');
  return JSON.parse(match[0]);
}

// ── GET /api/analytics/score ──────────────────────────────────
// Score 0-100 : note (40) + taux de réponse (30) + fréquence (20) + récence (10)

router.get('/score', verifyToken, async (req, res) => {
  try {
    console.log('[Analytics Score] Début — user:', req.user.id);

    const estabId = await getFirstEstablishmentId(req.user.id);
    console.log('[Analytics Score] estabId:', estabId);
    if (!estabId) return res.json({ score: 0, details: {} });

    const cached = await getCache(estabId, 'score');
    if (cached) { console.log('[Analytics Score] Cache hit'); return res.json(cached); }

    // Agrégats principaux
    console.log('[Analytics Score] Requête stats reviews...');
    const stats = await db.queryOne(
      `SELECT
         COUNT(*)::int AS total,
         COALESCE(AVG(rating), 0) AS avg_rating,
         COUNT(*) FILTER (WHERE ai_response IS NOT NULL)::int AS responded
       FROM reviews
       WHERE establishment_id = $1`,
      [estabId]
    );
    console.log('[Analytics Score] stats:', stats);

    if (!stats) throw new Error('La requête stats a retourné null — vérifier la table reviews');

    const total      = stats.total;
    const avgRating  = parseFloat(stats.avg_rating);
    const responded  = stats.responded;

    const noteScore     = total > 0 ? Math.round((avgRating / 5) * 40) : 0;
    const responseRate  = total > 0 ? responded / total : 0;
    const responseScore = Math.round(responseRate * 30);

    console.log('[Analytics Score] Requête fréquence...');
    const freqRow = await db.queryOne(
      `SELECT COUNT(*)::int AS recent
       FROM reviews
       WHERE establishment_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [estabId]
    );
    if (!freqRow) throw new Error('La requête fréquence a retourné null');
    const frequencyScore = Math.round(Math.min(freqRow.recent / 45, 1) * 20);

    console.log('[Analytics Score] Requête récence...');
    const lastRow = await db.queryOne(
      `SELECT created_at FROM reviews
       WHERE establishment_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [estabId]
    );
    let recencyScore = 0;
    if (lastRow) {
      const daysSince = (Date.now() - new Date(lastRow.created_at)) / 86400000;
      recencyScore = daysSince <= 7 ? 10 : daysSince <= 30 ? 7 : daysSince <= 90 ? 4 : 0;
    }

    const result = {
      score: noteScore + responseScore + frequencyScore + recencyScore,
      details: {
        note:      { points: noteScore,      max: 40, avg_rating: parseFloat(avgRating.toFixed(1)) },
        reponses:  { points: responseScore,  max: 30, taux: Math.round(responseRate * 100) },
        frequence: { points: frequencyScore, max: 20, avis_90j: freqRow.recent },
        recence:   { points: recencyScore,   max: 10 },
      },
    };

    console.log('[Analytics Score] Résultat:', result.score);
    await setCache(estabId, 'score', result);
    res.json(result);
  } catch (error) {
    console.error('[Analytics Score] ERREUR:', error.message);
    console.error('[Analytics Score] Stack:', error.stack);
    res.status(500).json({
      error: isProd ? 'Erreur lors du calcul du score.' : error.message,
    });
  }
});

// ── GET /api/analytics/themes ─────────────────────────────────
// Anthropic analyse les avis → [{theme, count, sentiment}]

router.get('/themes', verifyToken, async (req, res) => {
  try {
    const estabId = await getFirstEstablishmentId(req.user.id);
    if (!estabId) return res.json([]);

    const cached = await getCache(estabId, 'themes');
    if (cached) return res.json(cached);

    const reviews = await db.queryAll(
      `SELECT rating, comment AS text FROM reviews
       WHERE establishment_id = $1
         AND comment IS NOT NULL AND comment <> ''
       ORDER BY created_at DESC
       LIMIT 30`,
      [estabId]
    );

    if (reviews.length === 0) return res.json([]);

    const reviewsText = reviews
      .map(r => `[${r.rating}/5] ${r.text}`)
      .join('\n');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Tu analyses des avis clients et identifies les thèmes récurrents. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après.',
      messages: [{
        role: 'user',
        content: `Analyse ces avis et identifie les 5 thèmes principaux.
Retourne exactement ce format JSON (sans commentaire, sans markdown) :
[{"theme": "string", "count": number, "sentiment": "positif"|"neutre"|"négatif"}]

Avis :
${reviewsText}`,
      }],
    });

    let themes;
    try {
      themes = parseJsonArray(response.content[0].text);
    } catch (parseError) {
      console.error('[Analytics Themes] JSON parse error:', parseError.message);
      return res.status(500).json({ error: 'Erreur lors de l\'analyse des thèmes.' });
    }

    await setCache(estabId, 'themes', themes);
    res.json(themes);
  } catch (error) {
    console.error('[Analytics Themes] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de l\'analyse des thèmes.' : error.message,
    });
  }
});

// ── GET /api/analytics/suggestions ───────────────────────────
// Anthropic génère 3 recommandations → [{action, priorité, basé_sur}]

router.get('/suggestions', verifyToken, async (req, res) => {
  try {
    console.log('[Analytics Suggestions] Début — user:', req.user.id);

    const estabId = await getFirstEstablishmentId(req.user.id);
    console.log('[Analytics Suggestions] estabId:', estabId);
    if (!estabId) return res.json([]);

    const cached = await getCache(estabId, 'suggestions');
    if (cached) { console.log('[Analytics Suggestions] Cache hit'); return res.json(cached); }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[Analytics Suggestions] ANTHROPIC_API_KEY manquante');
      return res.status(503).json({ error: 'Service IA non configuré.' });
    }

    // Contexte : stats + avis négatifs récents
    console.log('[Analytics Suggestions] Requête stats...');
    const stats = await db.queryOne(
      `SELECT
         COUNT(*)::int AS total,
         COALESCE(AVG(rating), 0) AS avg_rating,
         COUNT(*) FILTER (WHERE ai_response IS NOT NULL)::int AS responded,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS recent_count
       FROM reviews
       WHERE establishment_id = $1`,
      [estabId]
    );
    console.log('[Analytics Suggestions] stats:', stats);
    if (!stats) throw new Error('La requête stats a retourné null — vérifier la table reviews');

    console.log('[Analytics Suggestions] Requête avis négatifs...');
    const negativeReviews = await db.queryAll(
      `SELECT comment AS text FROM reviews
       WHERE establishment_id = $1 AND rating <= 3
         AND comment IS NOT NULL AND comment <> ''
       ORDER BY created_at DESC
       LIMIT 5`,
      [estabId]
    );

    const responseRate = stats.total > 0
      ? Math.round((stats.responded / stats.total) * 100)
      : 0;

    const contextLines = [
      `Note moyenne : ${parseFloat(stats.avg_rating).toFixed(1)}/5`,
      `Nombre d'avis total : ${stats.total}`,
      `Taux de réponse : ${responseRate}%`,
      `Avis reçus ce mois : ${stats.recent_count}`,
    ];

    if (negativeReviews.length > 0) {
      contextLines.push(
        'Avis négatifs récents :',
        ...negativeReviews.map(r => `- ${r.text}`)
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'Tu es un consultant en réputation locale. Tu génères des recommandations concrètes et actionnables. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après.',
      messages: [{
        role: 'user',
        content: `Génère exactement 3 recommandations prioritaires basées sur ces données.
Retourne exactement ce format JSON (sans commentaire, sans markdown) :
[{"action": "string", "priorité": "haute"|"moyenne"|"faible", "basé_sur": "string"}]

Données :
${contextLines.join('\n')}`,
      }],
    });

    let suggestions;
    try {
      suggestions = parseJsonArray(response.content[0].text);
    } catch (parseError) {
      console.error('[Analytics Suggestions] JSON parse error:', parseError.message);
      return res.status(500).json({ error: 'Erreur lors de la génération des suggestions.' });
    }

    await setCache(estabId, 'suggestions', suggestions);
    res.json(suggestions);
  } catch (error) {
    console.error('[Analytics Suggestions] ERREUR:', error.message);
    console.error('[Analytics Suggestions] Stack:', error.stack);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la génération des suggestions.' : error.message,
    });
  }
});

// ── GET /api/analytics/history/:id ───────────────────────────
// Note moyenne + nb avis par mois sur 12 mois glissants

router.get('/history/:id', verifyToken, async (req, res) => {
  try {
    const estabId = parseInt(req.params.id, 10);
    if (!Number.isInteger(estabId) || estabId <= 0) {
      return res.status(400).json({ error: 'ID invalide.' });
    }

    const estab = await db.queryOne(
      'SELECT id FROM establishments WHERE id = $1 AND user_id = $2',
      [estabId, req.user.id]
    );
    if (!estab) return res.status(403).json({ error: 'Accès interdit.' });

    const cached = await getCache(estabId, 'history');
    if (cached) return res.json(cached);

    const rows = await db.queryAll(
      `WITH months AS (
         SELECT generate_series(
           DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
           DATE_TRUNC('month', NOW()),
           INTERVAL '1 month'
         ) AS month
       )
       SELECT
         TO_CHAR(m.month, 'YYYY-MM') AS month,
         COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0)::float AS avg_rating,
         COUNT(r.id)::int AS count
       FROM months m
       LEFT JOIN reviews r
         ON DATE_TRUNC('month', r.created_at) = m.month
         AND r.establishment_id = $1
       GROUP BY m.month
       ORDER BY m.month ASC`,
      [estabId]
    );

    await setCache(estabId, 'history', rows);
    res.json(rows);
  } catch (error) {
    console.error('[Analytics History] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors du chargement de l\'historique.' : error.message,
    });
  }
});

// ── GET /api/analytics/competitors/:id ───────────────────────
// 5 concurrents proches via Google Places Nearby Search, cache 24h

const GOOGLE_TYPE_MAP = {
  restaurant: 'restaurant',
  coiffeur:   'hair_care',
  boulangerie:'bakery',
  garage:     'car_repair',
  pharmacie:  'pharmacy',
  'hôtel':    'lodging',
  hotel:      'lodging',
  commerce:   'store',
};

router.get('/competitors/:id', verifyToken, checkPlanFeature('competitors'), async (req, res) => {
  try {
    const estabId = parseInt(req.params.id, 10);
    if (!Number.isInteger(estabId) || estabId <= 0) {
      return res.status(400).json({ error: 'ID invalide.' });
    }

    const estab = await db.queryOne(
      'SELECT id, name, type FROM establishments WHERE id = $1 AND user_id = $2',
      [estabId, req.user.id]
    );
    if (!estab) return res.status(403).json({ error: 'Accès interdit.' });

    const cached = await getCache(estabId, 'competitors');
    if (cached) return res.json(cached);

    if (!process.env.GOOGLE_API_KEY) {
      console.warn('[Analytics Competitors] GOOGLE_API_KEY non configurée');
      return res.json([]);
    }

    const apiKey      = process.env.GOOGLE_API_KEY;
    const googleType  = GOOGLE_TYPE_MAP[(estab.type || '').toLowerCase()] || 'store';

    // Étape 1 : Text Search pour obtenir les coordonnées de l'établissement
    const searchQuery = encodeURIComponent(estab.name);
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&type=${googleType}&language=fr&key=${apiKey}`;

    let location;
    try {
      const searchRes  = await fetch(textSearchUrl);
      const searchData = await searchRes.json();
      const place      = searchData.results && searchData.results[0];
      if (place && place.geometry) {
        location = place.geometry.location; // { lat, lng }
      }
    } catch (fetchErr) {
      console.error('[Analytics Competitors] Text search error:', fetchErr.message);
    }

    if (!location) {
      await setCache(estabId, 'competitors', []);
      return res.json([]);
    }

    // Étape 2 : Nearby Search — même type dans un rayon de 2km
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=2000&type=${googleType}&language=fr&key=${apiKey}`;

    let competitors = [];
    try {
      const nearbyRes  = await fetch(nearbyUrl);
      const nearbyData = await nearbyRes.json();

      competitors = (nearbyData.results || [])
        .filter(p => p.name.toLowerCase() !== estab.name.toLowerCase())
        .slice(0, 5)
        .map(p => ({
          name:        p.name,
          rating:      p.rating || null,
          reviewCount: p.user_ratings_total || 0,
          address:     p.vicinity || '',
        }));
    } catch (nearbyErr) {
      console.error('[Analytics Competitors] Nearby search error:', nearbyErr.message);
    }

    await setCache(estabId, 'competitors', competitors);
    res.json(competitors);
  } catch (error) {
    console.error('[Analytics Competitors] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la recherche de concurrents.' : error.message,
    });
  }
});

module.exports = router;

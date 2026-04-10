require('dotenv').config({ override: false });
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

/**
 * Recherche un établissement via Google Places Text Search.
 * Retourne { name, address, rating, reviewCount } ou null si introuvable.
 */
async function searchPlace(name, city) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY non configurée');

  const query = encodeURIComponent(`${name} ${city}`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=fr&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Places API HTTP ${res.status}`);

  const data = await res.json();

  if (!data.results || data.results.length === 0) return null;

  const place = data.results[0];
  return {
    name:        place.name || name,
    address:     place.formatted_address || '',
    rating:      place.rating || null,
    reviewCount: place.user_ratings_total || 0,
  };
}

/**
 * POST /api/audit/analyze
 * Corps : { name: string, city: string }
 * Retourne : { place, improvements }
 * Route publique — pas de JWT requis.
 */
router.post('/analyze', async (req, res) => {
  try {
    const { name, city } = req.body;

    // Validation
    if (!name || !city || typeof name !== 'string' || typeof city !== 'string') {
      return res.status(400).json({ error: 'Nom et ville requis.' });
    }

    const trimmedName = name.trim().slice(0, 100);
    const trimmedCity = city.trim().slice(0, 100);

    if (!trimmedName || !trimmedCity) {
      return res.status(400).json({ error: 'Nom et ville requis.' });
    }

    // Recherche Google Places
    let place;
    try {
      place = await searchPlace(trimmedName, trimmedCity);
    } catch (placesErr) {
      console.error('[Audit] Google Places error:', placesErr.message);
      return res.status(503).json({
        error: 'Service de recherche temporairement indisponible.',
      });
    }

    if (!place) {
      return res.status(404).json({
        error: 'Établissement introuvable sur Google Maps. Vérifiez le nom et la ville.',
      });
    }

    // Génération des 3 améliorations via Anthropic
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let improvements = [];
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Tu es un expert en réputation locale Google. Tu génères des recommandations concrètes et actionnables. Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ou après, sans markdown.',
        messages: [{
          role: 'user',
          content: `Commerce : ${place.name}
Adresse : ${place.address}
Note Google : ${place.rating !== null ? `${place.rating}/5` : 'Non renseignée'}
Nombre d'avis : ${place.reviewCount}

Génère exactement 3 améliorations prioritaires pour améliorer la réputation de ce commerce sur Google.
Format JSON strict :
[{"titre": "string", "description": "string (max 80 mots)", "impact": "fort"|"moyen"|"faible"}]`,
        }],
      });

      const raw = response.content[0].text.trim();
      const match = raw.match(/\[[\s\S]*\]/);
      improvements = JSON.parse(match ? match[0] : raw);
    } catch (aiErr) {
      console.error('[Audit] Anthropic error:', aiErr.message);
      // On retourne le résultat sans améliorations plutôt que de bloquer
      improvements = [];
    }

    res.json({ place, improvements });
  } catch (error) {
    console.error('[Audit Analyze] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de l\'analyse.' : error.message,
    });
  }
});

module.exports = router;

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');
const { canAddEstablishment, PLAN_LIMITS } = require('../utils/planLimits');

const router = express.Router();

/**
 * GET /api/establishments
 * Liste tous les établissements de l'utilisateur connecté
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const establishments = await db.queryAll(
      'SELECT id, name, type, google_account_id, google_location_id, created_at FROM establishments WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id]
    );

    // Récupérer le plan de l'utilisateur pour afficher la limite
    const user = await db.queryOne('SELECT plan, trial_ends_at FROM users WHERE id = $1', [req.user.id]);
    const plan = user?.plan || 'free';
    const limit = PLAN_LIMITS[plan] || 0;

    const trialEndsAt = user?.trial_ends_at || null;
    const daysLeft = trialEndsAt
      ? Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    res.json({
      establishments,
      plan,
      limit,
      count: establishments.length,
      trial_ends_at: trialEndsAt,
      days_left: daysLeft,
    });
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[GET /establishments] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la récupération des établissements.' : error.message,
    });
  }
});

/**
 * POST /api/establishments
 * Crée un nouvel établissement
 * Body : { name, type }
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom de l\'établissement est requis.' });
    }

    if (name.trim().length > 255) {
      return res.status(400).json({ error: 'Le nom ne peut pas dépasser 255 caractères.' });
    }

    if (type && type.trim().length > 100) {
      return res.status(400).json({ error: 'Le type ne peut pas dépasser 100 caractères.' });
    }

    // Récupérer le plan et compter les établissements existants
    const user = await db.queryOne('SELECT plan FROM users WHERE id = $1', [req.user.id]);
    const plan = user?.plan || 'free';

    const countResult = await db.queryOne(
      'SELECT COUNT(*) as count FROM establishments WHERE user_id = $1',
      [req.user.id]
    );
    const currentCount = parseInt(countResult.count, 10);

    if (!canAddEstablishment(plan, currentCount)) {
      const limit = PLAN_LIMITS[plan] || 0;
      return res.status(403).json({
        error: `Limite atteinte. Votre plan "${plan}" permet ${limit} établissement(s). Passez à un plan supérieur pour en ajouter davantage.`,
      });
    }

    const establishment = await db.queryOne(
      'INSERT INTO establishments (user_id, name, type) VALUES ($1, $2, $3) RETURNING id, name, type, created_at',
      [req.user.id, name.trim(), type ? type.trim() : null]
    );

    res.status(201).json({ establishment });
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[POST /establishments] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la création de l\'établissement.' : error.message,
    });
  }
});

/**
 * DELETE /api/establishments/:id
 * Supprime un établissement appartenant à l'utilisateur connecté
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id, 10))) {
      return res.status(400).json({ error: 'ID d\'établissement invalide.' });
    }

    const deleted = await db.queryOne(
      'DELETE FROM establishments WHERE id = $1 AND user_id = $2 RETURNING id',
      [parseInt(id, 10), req.user.id]
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Établissement introuvable ou accès refusé.' });
    }

    res.json({ message: 'Établissement supprimé.' });
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[DELETE /establishments/:id] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la suppression de l\'établissement.' : error.message,
    });
  }
});

module.exports = router;

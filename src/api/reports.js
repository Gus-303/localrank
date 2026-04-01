const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { queryOne } = require('../utils/db');
const { getMonthlyStats, generateMonthlyPDF } = require('../services/pdf');

const router = express.Router();

// Valide le format YYYY-MM
function isValidMonth(month) {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/**
 * GET /api/reports/:establishmentId/monthly?month=YYYY-MM
 * Génère et retourne le rapport PDF mensuel d'un établissement.
 * L'utilisateur ne peut accéder qu'à ses propres établissements.
 */
router.get('/:establishmentId/monthly', verifyToken, async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';

  try {
    const establishmentId = parseInt(req.params.establishmentId, 10);

    if (isNaN(establishmentId)) {
      return res.status(400).json({ error: 'ID établissement invalide.' });
    }

    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ error: 'Paramètre "month" requis (format : YYYY-MM).' });
    }

    if (!isValidMonth(month)) {
      return res.status(400).json({ error: 'Format de mois invalide. Attendu : YYYY-MM (ex: 2024-03).' });
    }

    // Vérifier que l'établissement appartient à l'utilisateur connecté
    const ownership = await queryOne(
      'SELECT id FROM establishments WHERE id = $1 AND user_id = $2',
      [establishmentId, req.user.id]
    );

    if (!ownership) {
      return res.status(404).json({ error: 'Établissement introuvable ou accès refusé.' });
    }

    const data = await getMonthlyStats(establishmentId, month);

    if (!data) {
      return res.status(404).json({ error: 'Établissement introuvable.' });
    }

    const pdfBuffer = await generateMonthlyPDF(
      data.establishment,
      data.stats,
      data.reviews,
      month
    );

    const filename = `rapport-${data.establishment.name.replace(/\s+/g, '-').toLowerCase()}-${month}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[GET /reports/:id/monthly] Erreur:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la génération du rapport.' : error.message,
    });
  }
});

module.exports = router;

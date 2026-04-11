const express = require('express');
const QRCode = require('qrcode');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';

/**
 * Échappe les caractères HTML pour éviter les injections XSS.
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convertit une note numérique en étoiles Unicode.
 */
function stars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// ── POST /api/tools/generate-slug/:id ────────────────────────
// Génère un slug depuis le nom de l'établissement et l'enregistre en DB.
// Retourne { slug }.

/**
 * Convertit un nom en slug URL-safe.
 * Ex : "Coiffure & Beauté Martin" → "coiffure-beaute-martin"
 */
function nameToSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // supprime les accents
    .replace(/[^a-z0-9\s-]/g, ' ')    // remplace les caractères spéciaux par espace
    .trim()
    .replace(/[\s-]+/g, '-')           // espaces → tirets (multiples → un seul)
    .replace(/^-+|-+$/g, '')           // supprime tirets en début/fin
    .slice(0, 80);                     // limite à 80 caractères
}

router.post('/generate-slug/:id', verifyToken, async (req, res) => {
  try {
    const estabId = parseInt(req.params.id, 10);
    if (!Number.isInteger(estabId) || estabId <= 0) {
      return res.status(400).json({ error: 'ID invalide.' });
    }

    const estab = await db.queryOne(
      'SELECT id, name FROM establishments WHERE id = $1 AND user_id = $2',
      [estabId, req.user.id]
    );

    if (!estab) {
      return res.status(404).json({ error: 'Établissement introuvable.' });
    }

    const base = nameToSlug(estab.name);
    if (!base) {
      return res.status(400).json({ error: 'Impossible de générer un slug depuis ce nom.' });
    }

    // Cherche un slug unique en ajoutant un suffixe numérique si nécessaire
    let slug    = base;
    let attempt = 2;
    while (attempt <= 99) {
      const existing = await db.queryOne(
        'SELECT id FROM establishments WHERE slug = $1 AND id <> $2',
        [slug, estabId]
      );
      if (!existing) break;
      slug = `${base}-${attempt}`;
      attempt++;
    }

    if (attempt > 99) {
      return res.status(409).json({ error: 'Impossible de trouver un slug unique pour ce nom.' });
    }

    await db.query(
      'UPDATE establishments SET slug = $1 WHERE id = $2',
      [slug, estabId]
    );

    console.log(`[Tools GenerateSlug] estab ${estabId} → slug "${slug}"`);
    res.json({ slug });
  } catch (error) {
    console.error('[Tools GenerateSlug] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la génération du slug.' : error.message,
    });
  }
});

// ── GET /api/tools/qrcode/:id ─────────────────────────────────
// Génère un PNG QR code pointant vers la page publique /p/:slug
// Protégé : l'utilisateur doit posséder l'établissement

router.get('/qrcode/:id', verifyToken, async (req, res) => {
  try {
    const estabId = parseInt(req.params.id, 10);
    if (!Number.isInteger(estabId) || estabId <= 0) {
      return res.status(400).json({ error: 'ID d\'établissement invalide.' });
    }

    const estab = await db.queryOne(
      'SELECT id, slug FROM establishments WHERE id = $1 AND user_id = $2',
      [estabId, req.user.id]
    );

    if (!estab) {
      return res.status(404).json({ error: 'Établissement introuvable.' });
    }

    if (!estab.slug) {
      return res.status(400).json({ error: 'Cet établissement n\'a pas encore de page publique (slug manquant).' });
    }

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const url = `${baseUrl}/p/${estab.slug}`;

    const png = await QRCode.toBuffer(url, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qrcode-${estab.slug}.png"`);
    res.send(png);
  } catch (error) {
    console.error('[Tools QRCode] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la génération du QR code.' : error.message,
    });
  }
});

// ── GET /widget/:id ───────────────────────────────────────────
// Route publique (sans auth) — snippet HTML avec les 5 meilleurs avis

router.get('/widget/:id', async (req, res) => {
  try {
    const estabId = parseInt(req.params.id, 10);
    if (!Number.isInteger(estabId) || estabId <= 0) {
      return res.status(400).send('<p>ID invalide.</p>');
    }

    const estab = await db.queryOne(
      'SELECT name, type FROM establishments WHERE id = $1',
      [estabId]
    );

    if (!estab) {
      return res.status(404).send('<p>Établissement introuvable.</p>');
    }

    const reviews = await db.queryAll(
      `SELECT author, rating, comment AS text, created_at
       FROM reviews
       WHERE establishment_id = $1 AND comment IS NOT NULL AND comment <> ''
       ORDER BY rating DESC, created_at DESC
       LIMIT 5`,
      [estabId]
    );

    const scoreRow = await db.queryOne(
      `SELECT COALESCE(AVG(rating), 0) AS avg, COUNT(*)::int AS total
       FROM reviews WHERE establishment_id = $1`,
      [estabId]
    );

    const avg   = parseFloat(parseFloat(scoreRow.avg).toFixed(1));
    const total = scoreRow.total;

    const reviewCards = reviews.map(r => `
  <div style="padding:12px 0;border-bottom:0.5px solid rgba(0,0,0,0.08)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:13px;font-weight:500;color:#1a1a1a">${escapeHtml(r.author)}</span>
      <span style="font-size:11px;color:#f59e0b;letter-spacing:1px">${stars(r.rating)}</span>
    </div>
    <p style="font-size:12px;color:#6b6b6b;line-height:1.5;margin:0">${escapeHtml(r.text)}</p>
  </div>`).join('');

    const html = `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:480px;border:0.5px solid rgba(0,0,0,0.08);border-radius:10px;padding:18px;background:#fff">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:0.5px solid rgba(0,0,0,0.08)">
    <span style="font-size:13px;font-weight:500;color:#1a1a1a">${escapeHtml(estab.name)}</span>
    <span style="font-size:13px;color:#6b6b6b">${stars(avg)}&nbsp;<strong style="color:#1a1a1a">${avg}</strong>&nbsp;<span style="font-size:11px">(${total} avis)</span></span>
  </div>
  ${reviewCards || '<p style="font-size:12px;color:#999;text-align:center;padding:16px 0">Aucun avis pour le moment.</p>'}
  <div style="margin-top:12px;padding-top:10px;border-top:0.5px solid rgba(0,0,0,0.08);text-align:right">
    <span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:.06em">Propulsé par LocalRank</span>
  </div>
</div>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.send(html);
  } catch (error) {
    console.error('[Tools Widget] Error:', error.message);
    res.status(500).send('<p>Erreur lors du chargement du widget.</p>');
  }
});

// ── GET /p/:slug ──────────────────────────────────────────────
// Page publique HTML : nom, score analytics, note, avis récents

router.get('/p/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;

    // Valider le slug : lettres, chiffres, tirets uniquement
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) {
      return res.status(400).send('<p>Page introuvable.</p>');
    }

    const estab = await db.queryOne(
      'SELECT id, name, type FROM establishments WHERE slug = $1',
      [slug]
    );

    if (!estab) {
      return res.status(404).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Page introuvable</title></head><body style="font-family:system-ui;text-align:center;padding:60px"><h1>Page introuvable</h1></body></html>`);
    }

    const scoreRow = await db.queryOne(
      `SELECT COALESCE(AVG(rating), 0) AS avg, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE response_text IS NOT NULL)::int AS responded
       FROM reviews WHERE establishment_id = $1`,
      [estab.id]
    );

    const avg          = parseFloat(parseFloat(scoreRow.avg).toFixed(1));
    const total        = scoreRow.total;
    const responseRate = total > 0 ? Math.round((scoreRow.responded / total) * 100) : 0;

    // Score 0-100 simplifié (même formule que /api/analytics/score)
    const noteScore     = total > 0 ? Math.round((avg / 5) * 40) : 0;
    const responseScore = Math.round((responseRate / 100) * 30);
    const freqRow       = await db.queryOne(
      `SELECT COUNT(*)::int AS recent FROM reviews
       WHERE establishment_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [estab.id]
    );
    const frequencyScore = Math.round(Math.min(freqRow.recent / 45, 1) * 20);
    const lastRow        = await db.queryOne(
      `SELECT created_at FROM reviews WHERE establishment_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [estab.id]
    );
    let recencyScore = 0;
    if (lastRow) {
      const days = (Date.now() - new Date(lastRow.created_at)) / 86400000;
      recencyScore = days <= 7 ? 10 : days <= 30 ? 7 : days <= 90 ? 4 : 0;
    }
    const score = noteScore + responseScore + frequencyScore + recencyScore;

    const reviews = await db.queryAll(
      `SELECT author, rating, comment AS text, created_at
       FROM reviews
       WHERE establishment_id = $1 AND comment IS NOT NULL AND comment <> ''
       ORDER BY created_at DESC
       LIMIT 10`,
      [estab.id]
    );

    const reviewItems = reviews.map(r => `
          <div class="review">
            <div class="review-meta">
              <span class="review-author">${escapeHtml(r.author)}</span>
              <div class="review-right">
                <span class="review-stars">${stars(r.rating)}</span>
                <span class="review-date">${new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
            <p class="review-text">${escapeHtml(r.text)}</p>
          </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(estab.name)} — LocalRank</title>
  <meta name="description" content="Avis et réputation de ${escapeHtml(estab.name)} sur LocalRank.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',system-ui,sans-serif;background:#f7f7f6;color:#1a1a1a;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
    .page{max-width:640px;margin:0 auto;padding:32px 20px 64px}
    .header{background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:10px;padding:24px;margin-bottom:16px}
    .header-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
    .estab-name{font-size:22px;font-weight:500;color:#1a1a1a}
    .estab-type{font-size:12px;color:#999;margin-top:2px}
    .score-badge{background:#1a1a1a;color:#fff;border-radius:8px;padding:8px 14px;text-align:center}
    .score-value{font-size:22px;font-weight:500;line-height:1}
    .score-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-top:2px}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .stat{background:#f7f7f6;border-radius:8px;padding:12px 14px}
    .stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#6b6b6b;margin-bottom:6px}
    .stat-value{font-size:22px;font-weight:500;color:#1a1a1a;line-height:1}
    .stat-sub{font-size:11px;color:#999;margin-top:3px}
    .card{background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:10px;padding:18px;margin-bottom:12px}
    .card-title{font-size:13px;font-weight:500;color:#1a1a1a;margin-bottom:14px;padding-bottom:12px;border-bottom:0.5px solid rgba(0,0,0,0.08)}
    .review{padding:12px 0;border-bottom:0.5px solid rgba(0,0,0,0.08)}
    .review:last-child{border-bottom:none;padding-bottom:0}
    .review-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
    .review-author{font-size:13px;font-weight:500}
    .review-right{display:flex;align-items:center;gap:8px}
    .review-stars{font-size:11px;color:#f59e0b;letter-spacing:1px}
    .review-date{font-size:11px;color:#999}
    .review-text{font-size:13px;color:#6b6b6b;line-height:1.6}
    .empty{text-align:center;padding:32px 0;font-size:13px;color:#999}
    .footer{text-align:center;margin-top:32px;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.06em}
    @media(max-width:480px){.stats{grid-template-columns:1fr 1fr}.header-top{flex-direction:column;gap:12px}}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <div>
          <div class="estab-name">${escapeHtml(estab.name)}</div>
          ${estab.type ? `<div class="estab-type">${escapeHtml(estab.type)}</div>` : ''}
        </div>
        <div class="score-badge">
          <div class="score-value">${score}</div>
          <div class="score-label">Score LocalRank</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Note Google</div>
          <div class="stat-value">${avg > 0 ? avg : '—'}</div>
          <div class="stat-sub">${avg > 0 ? stars(avg) : 'Aucun avis'}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Avis reçus</div>
          <div class="stat-value">${total}</div>
          <div class="stat-sub">au total</div>
        </div>
        <div class="stat">
          <div class="stat-label">Réponses</div>
          <div class="stat-value">${responseRate}%</div>
          <div class="stat-sub">des avis</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Avis récents</div>
      ${reviewItems || '<div class="empty">Aucun avis pour le moment.</div>'}
    </div>

    <div class="footer">Propulsé par <strong>LocalRank</strong></div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('[Tools PublicPage] Error:', error.message);
    res.status(500).send('<p>Erreur lors du chargement de la page.</p>');
  }
});

module.exports = router;

require('dotenv').config({ override: false });
const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');

const isProd = process.env.NODE_ENV === 'production';

// ── ROUTER CAMPAGNES (/api/campaigns) ──────────────────────────
const campaignsRouter = express.Router();

// ── ROUTER REDIRECT (/r) ───────────────────────────────────────
const redirectRouter = express.Router();

/**
 * Parse un texte CSV simple (une ligne = email,nom).
 * Retourne un tableau de { email, name }.
 * Limite : 500 contacts max.
 */
function parseCsv(csvText) {
  return csvText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.toLowerCase().startsWith('email'))
    .slice(0, 500)
    .reduce((acc, line) => {
      const parts = line.split(',');
      const email = (parts[0] || '').trim();
      const name  = (parts[1] || '').trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        acc.push({ email, name: name || email.split('@')[0] });
      }
      return acc;
    }, []);
}

/**
 * GET /api/campaigns
 * Liste les campagnes de l'utilisateur avec le nombre de contacts et le taux de clic.
 */
campaignsRouter.get('/', verifyToken, async (req, res) => {
  try {
    const rows = await db.queryAll(
      `SELECT
         c.id,
         c.subject,
         c.status,
         c.clicks,
         c.sent_at,
         c.created_at,
         COUNT(cl.id)::int AS contacts_total
       FROM campaigns c
       LEFT JOIN campaign_links cl ON cl.campaign_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('[Campaigns List] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors du chargement des campagnes.' : error.message,
    });
  }
});

/**
 * POST /api/campaigns/preview
 * Corps : { establishment_id, subject }
 * Génère un aperçu du message IA sans envoyer ni enregistrer.
 */
campaignsRouter.post('/preview', verifyToken, async (req, res) => {
  try {
    const { establishment_id, subject } = req.body;

    if (!establishment_id || !subject) {
      return res.status(400).json({ error: 'establishment_id et subject sont requis.' });
    }
    if (typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'L\'objet ne peut pas être vide.' });
    }

    const estab = await db.queryOne(
      'SELECT id, name, type FROM establishments WHERE id = $1 AND user_id = $2',
      [establishment_id, req.user.id]
    );
    if (!estab) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const aiResult = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'Tu rédiges des emails professionnels et chaleureux pour demander des avis Google à des clients. Maximum 80 mots. Corps du message uniquement, sans objet ni signature, sans mise en forme markdown.',
      messages: [{
        role: 'user',
        content: `Rédige un email pour demander un avis Google à un client de ce commerce.
Commerce : ${estab.name} (${estab.type || 'Commerce'})
Le lien vers la page d'avis sera ajouté automatiquement en fin de message.
Ton : chaleureux, bref, personnalisé avec "Bonjour [prénom]".`,
      }],
    });

    res.json({ message: aiResult.content[0].text.trim() });
  } catch (error) {
    console.error('[Campaigns Preview] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la génération de l\'aperçu.' : error.message,
    });
  }
});

/**
 * POST /api/campaigns/send
 * Corps : { establishment_id, csv, subject, redirect_url? }
 * - Parse les contacts CSV
 * - Génère le message via Anthropic
 * - Envoie un email par contact avec lien tracké /r/:token
 * - Enregistre la campagne en DB
 */
campaignsRouter.post('/send', verifyToken, async (req, res) => {
  try {
    const { establishment_id, csv, subject, redirect_url } = req.body;

    // Validation des inputs
    if (!establishment_id || !csv || !subject) {
      return res.status(400).json({ error: 'establishment_id, csv et subject sont requis.' });
    }
    if (typeof csv !== 'string' || typeof subject !== 'string') {
      return res.status(400).json({ error: 'Format de données invalide.' });
    }

    const trimmedSubject = subject.trim().slice(0, 255);
    if (!trimmedSubject) {
      return res.status(400).json({ error: 'L\'objet ne peut pas être vide.' });
    }

    // Vérifier l'ownership de l'établissement
    const estab = await db.queryOne(
      'SELECT id, name, type, slug FROM establishments WHERE id = $1 AND user_id = $2',
      [establishment_id, req.user.id]
    );
    if (!estab) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    // Parser le CSV
    const contacts = parseCsv(csv);
    if (contacts.length === 0) {
      return res.status(400).json({ error: 'Aucun contact valide dans le CSV (format attendu : email,nom).' });
    }

    // Générer le message via Anthropic
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const aiResult = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'Tu rédiges des emails professionnels et chaleureux pour demander des avis Google à des clients. Maximum 80 mots. Corps du message uniquement, sans objet ni signature, sans mise en forme markdown.',
      messages: [{
        role: 'user',
        content: `Rédige un email pour demander un avis Google à un client de ce commerce.
Commerce : ${estab.name} (${estab.type || 'Commerce'})
Le lien vers la page d'avis sera ajouté automatiquement en fin de message.
Ton : chaleureux, bref, personnalisé avec "Bonjour [prénom]".`,
      }],
    });
    const messageTemplate = aiResult.content[0].text.trim();

    // Créer la campagne en DB
    const campaign = await db.queryOne(
      `INSERT INTO campaigns (establishment_id, user_id, subject, message, status, clicks)
       VALUES ($1, $2, $3, $4, 'sending', 0)
       RETURNING id`,
      [estab.id, req.user.id, trimmedSubject, messageTemplate]
    );

    // Configurer le transporteur SMTP
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const finalRedirectUrl = typeof redirect_url === 'string' && redirect_url.startsWith('http')
      ? redirect_url.slice(0, 500)
      : `${baseUrl}/p/${estab.slug || estab.id}`;

    let transporter = null;
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else {
      console.warn('[Campaigns] SMTP non configuré — emails non envoyés');
    }

    // Envoyer à chaque contact + stocker le lien tracké
    let sent = 0;
    for (const contact of contacts) {
      const token = crypto.randomBytes(16).toString('hex');

      await db.query(
        `INSERT INTO campaign_links (campaign_id, token, recipient_email, redirect_url)
         VALUES ($1, $2, $3, $4)`,
        [campaign.id, token, contact.email, finalRedirectUrl]
      );

      if (transporter) {
        const trackedLink = `${baseUrl}/r/${token}`;
        const firstName   = contact.name.split(' ')[0];
        const body        = messageTemplate.replace('[prénom]', firstName) + `\n\n${trackedLink}\n\n— ${estab.name}`;

        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || `LocalRank <no-reply@localrank.fr>`,
            to:   contact.email,
            subject: trimmedSubject,
            text: body,
          });
          sent++;
        } catch (mailErr) {
          console.error('[Campaigns] Échec envoi à', contact.email, ':', mailErr.message);
        }
      }
    }

    // Marquer la campagne comme envoyée
    await db.query(
      `UPDATE campaigns SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [campaign.id]
    );

    res.json({
      campaign_id:      campaign.id,
      contacts_total:   contacts.length,
      sent,
      smtp_configured:  !!transporter,
    });
  } catch (error) {
    console.error('[Campaigns Send] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de l\'envoi de la campagne.' : error.message,
    });
  }
});

/**
 * GET /r/:token
 * Lien tracké : enregistre le clic (une seule fois), incrémente campaign.clicks, redirige.
 */
redirectRouter.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Valider le format du token (32 hex chars)
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return res.status(400).send('Lien invalide.');
    }

    const link = await db.queryOne(
      'SELECT id, campaign_id, redirect_url, clicked_at FROM campaign_links WHERE token = $1',
      [token]
    );

    if (!link) {
      return res.status(404).send('Lien introuvable.');
    }

    // Incrémenter uniquement au premier clic
    if (!link.clicked_at) {
      await db.query(
        'UPDATE campaign_links SET clicked_at = NOW() WHERE id = $1',
        [link.id]
      );
      await db.query(
        'UPDATE campaigns SET clicks = clicks + 1 WHERE id = $1',
        [link.campaign_id]
      );
    }

    res.redirect(302, link.redirect_url);
  } catch (error) {
    console.error('[Campaigns Redirect] Error:', error.message);
    res.status(500).send('Erreur lors de la redirection.');
  }
});

module.exports = { campaignsRouter, redirectRouter };

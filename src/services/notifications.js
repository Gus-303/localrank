require('dotenv').config({ override: false });
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../utils/db');

/**
 * Crée le transporteur SMTP depuis les variables d'environnement.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Envoie un email d'alerte à l'utilisateur pour un avis négatif.
 * @param {{ email: string }} user
 * @param {{ author: string, rating: number, text: string, aiResponse?: string }} review
 */
async function sendAlertEmail(user, review) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('[Notifications] SMTP non configuré — email non envoyé');
    return;
  }

  const transporter = createTransporter();

  const body = [
    'Bonjour,',
    '',
    'Votre établissement a reçu un avis négatif :',
    '',
    `Auteur : ${review.author || 'Anonyme'}`,
    `Note   : ${review.rating}/5`,
    `Avis   : ${review.text || ''}`,
    '',
    review.aiResponse
      ? `Réponse suggérée par IA :\n${review.aiResponse}`
      : '',
    '',
    'Connectez-vous à LocalRank pour répondre à cet avis.',
    '',
    '— L\'équipe LocalRank',
  ].join('\n');

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'LocalRank <no-reply@localrank.fr>',
      to: user.email,
      subject: `[LocalRank] Alerte crise — ${review.rating}/5 étoiles`,
      text: body,
    });
    console.log('[Notifications] Email d\'alerte envoyé à:', user.email);
  } catch (error) {
    console.error('[Notifications] Échec envoi email:', error.message);
    throw error;
  }
}

/**
 * Détecte une situation de crise pour un établissement.
 * Critère : 3 avis ou plus avec note ≤ 3 dans les dernières 24h.
 * Si crise détectée : enregistre l'alerte + génère réponse IA + envoie email.
 * @param {number} establishmentId
 */
async function detectCrisis(establishmentId) {
  try {
    // Compter les avis ≤ 3 étoiles dans les dernières 24h
    const row = await db.queryOne(
      `SELECT COUNT(*)::int AS count
       FROM reviews
       WHERE establishment_id = $1
         AND rating <= 3
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [establishmentId]
    );

    if (!row || row.count < 3) return;

    console.log('[Notifications] Crise détectée — establishment:', establishmentId, '—', row.count, 'avis négatifs en 24h');

    // Éviter le doublon d'alerte dans la même fenêtre 24h
    const recentAlert = await db.queryOne(
      `SELECT id FROM alerts
       WHERE establishment_id = $1
         AND type = 'crisis'
         AND triggered_at > NOW() - INTERVAL '24 hours'`,
      [establishmentId]
    );

    if (recentAlert) {
      console.log('[Notifications] Alerte crise déjà envoyée pour establishment:', establishmentId);
      return;
    }

    // Récupérer les infos établissement + utilisateur
    const estab = await db.queryOne(
      `SELECT e.id, e.name, e.type, u.id AS user_id, u.email
       FROM establishments e
       JOIN users u ON e.user_id = u.id
       WHERE e.id = $1`,
      [establishmentId]
    );

    if (!estab) return;

    // Récupérer l'avis négatif le plus récent
    const review = await db.queryOne(
      `SELECT author, rating, comment AS text
       FROM reviews
       WHERE establishment_id = $1
         AND rating <= 3
       ORDER BY created_at DESC
       LIMIT 1`,
      [establishmentId]
    );

    if (!review) return;

    // Générer une réponse IA pour cet avis
    let aiResponse = null;
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const aiResult = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: 'Tu aides les commerces locaux à répondre aux avis négatifs de façon professionnelle et apaisante en français. Maximum 120 mots.',
        messages: [{
          role: 'user',
          content: `Avis négatif (${review.rating}/5) : "${review.text || ''}"
Commerce : ${estab.name} (${estab.type || 'Commerce'})
Génère une réponse courte et professionnelle.`,
        }],
      });
      aiResponse = aiResult.content[0].text.trim();
    } catch (aiError) {
      console.error('[Notifications] Erreur génération IA:', aiError.message);
      // Continue sans réponse IA — l'alerte est quand même envoyée
    }

    // Enregistrer l'alerte en base
    await db.query(
      `INSERT INTO alerts (user_id, establishment_id, type, triggered_at)
       VALUES ($1, $2, 'crisis', NOW())`,
      [estab.user_id, establishmentId]
    );

    // Envoyer l'email
    await sendAlertEmail(
      { email: estab.email },
      { ...review, aiResponse }
    );
  } catch (error) {
    // Les erreurs de notification ne doivent pas faire planter l'app
    console.error('[Notifications] Erreur detectCrisis:', error.message);
  }
}

module.exports = { sendAlertEmail, detectCrisis };

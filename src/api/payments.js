const express = require('express');
const Stripe = require('stripe');
const { verifyToken } = require('../middleware/auth');
const db = require('../utils/db');

const router = express.Router();

/**
 * GET /api/payments/prices
 * Retourne les IDs de prix Stripe depuis les variables d'environnement
 * Route publique — les priceIds ne sont jamais exposés dans le frontend
 */
router.get('/prices', (req, res) => {
  const { STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_AGENCY } = process.env;

  if (!STRIPE_PRICE_STARTER || !STRIPE_PRICE_PRO || !STRIPE_PRICE_AGENCY) {
    console.error('[GET /prices] Variables STRIPE_PRICE_* manquantes');
    return res.status(500).json({ error: 'Configuration des prix manquante.' });
  }

  res.json({
    starter: STRIPE_PRICE_STARTER,
    pro: STRIPE_PRICE_PRO,
    agency: STRIPE_PRICE_AGENCY,
  });
});

/**
 * POST /api/payments/create-checkout
 * Crée une session Stripe Checkout
 * Body : { priceId }
 * Protégée par verifyToken
 */
router.post('/create-checkout', verifyToken, async (req, res) => {
  try {
    const { priceId } = req.body;

    if (!priceId || !priceId.trim()) {
      return res.status(400).json({ error: 'priceId requis.' });
    }

    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
      console.error('[create-checkout] BACKEND_URL non configuré');
      return res.status(500).json({ error: 'Configuration serveur manquante.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId.trim(), quantity: 1 }],
      success_url: `${backendUrl}/pages/dashboard.html?success=true`,
      cancel_url: `${backendUrl}/pages/index.html`,
      client_reference_id: String(req.user.id),
      customer_email: req.user.email,
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[create-checkout] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la création du paiement.' : error.message,
    });
  }
});

/**
 * Détermine le plan à partir du priceId Stripe
 * @param {string} priceId
 * @returns {string|null}
 */
function getPlanFromPriceId(priceId) {
  const { STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_AGENCY } = process.env;
  if (priceId === STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === STRIPE_PRICE_PRO) return 'pro';
  if (priceId === STRIPE_PRICE_AGENCY) return 'agency';
  return null;
}

/**
 * GET /api/payments/success
 * Met à jour subscription_status = 'active' et le plan pour l'utilisateur connecté
 * Query param optionnel : priceId
 * Protégée par verifyToken
 */
router.get('/success', verifyToken, async (req, res) => {
  try {
    const { priceId } = req.query;
    const plan = priceId ? getPlanFromPriceId(priceId) : null;

    let result;
    if (plan) {
      result = await db.queryOne(
        'UPDATE users SET subscription_status = $1, plan = $2 WHERE id = $3 RETURNING id, email, subscription_status, plan',
        ['active', plan, req.user.id]
      );
    } else {
      result = await db.queryOne(
        'UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, email, subscription_status, plan',
        ['active', req.user.id]
      );
    }

    if (!result) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    res.json({
      message: 'Abonnement activé.',
      subscriptionStatus: result.subscription_status,
      plan: result.plan,
    });
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';
    console.error('[success] Error:', error.message);
    res.status(500).json({
      error: isProd ? 'Erreur lors de la mise à jour de l\'abonnement.' : error.message,
    });
  }
});

module.exports = router;

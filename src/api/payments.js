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
      success_url: `${backendUrl}/pages/dashboard.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
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
 * Récupère la session Stripe via session_id, identifie l'utilisateur via
 * client_reference_id (ou customer_email en fallback), déduit le plan depuis
 * le priceId, puis met à jour subscription_status = 'active' et plan.
 * Query param requis : session_id
 * Protégée par verifyToken
 */
router.get('/success', verifyToken, async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id || !session_id.trim()) {
      return res.status(400).json({ error: 'session_id requis.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    const session = await stripe.checkout.sessions.retrieve(session_id.trim(), {
      expand: ['line_items'],
    });

    console.log('[success] session.client_reference_id:', session.client_reference_id);
    console.log('[success] session.customer_email:', session.customer_email);
    console.log('[success] req.user.id:', req.user.id);

    // Étape 1 : identifier l'utilisateur via client_reference_id
    let userId = null;
    const refId = parseInt(session.client_reference_id, 10);
    if (!isNaN(refId)) {
      const found = await db.queryOne('SELECT id FROM users WHERE id = $1', [refId]);
      if (found) userId = found.id;
    }

    // Étape 2 : fallback sur l'email du customer Stripe
    if (!userId && session.customer_email) {
      const found = await findUserByEmail(session.customer_email);
      if (found) userId = found.id;
    }

    if (!userId) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const priceId = session.line_items?.data?.[0]?.price?.id || null;
    const plan = priceId ? getPlanFromPriceId(priceId) : null;

    let result;
    if (plan) {
      result = await db.queryOne(
        'UPDATE users SET subscription_status = $1, plan = $2 WHERE id = $3 RETURNING id, email, subscription_status, plan',
        ['active', plan, userId]
      );
    } else {
      result = await db.queryOne(
        'UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, email, subscription_status, plan',
        ['active', userId]
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

/**
 * Retrouve un utilisateur par email dans la DB.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findUserByEmail(email) {
  if (!email) return null;
  return db.queryOne('SELECT id, email FROM users WHERE email = $1', [email]);
}

/**
 * POST /api/payments/webhook
 * Reçoit les événements Stripe en temps réel.
 * Route non protégée par verifyToken — Stripe envoie directement.
 * Requiert express.raw() en amont (configuré dans app.js).
 */
router.post('/webhook', async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET non configuré');
    return res.status(500).json({ error: 'Configuration webhook manquante.' });
  }

  let event;
  try {
    event = Stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] Signature invalide:', err.message);
    return res.status(400).json({ error: 'Signature webhook invalide.' });
  }

  const eventType = event.type;
  const data = event.data.object;
  console.log(`[webhook] Événement reçu: ${eventType}`);

  try {
    switch (eventType) {

      case 'checkout.session.completed': {
        const userId = data.client_reference_id;
        if (!userId) {
          console.error('[webhook] checkout.session.completed: client_reference_id manquant');
          break;
        }
        const priceId = data.line_items?.data?.[0]?.price?.id || null;
        const plan = priceId ? getPlanFromPriceId(priceId) : null;

        if (plan) {
          await db.queryOne(
            'UPDATE users SET subscription_status = $1, plan = $2 WHERE id = $3 RETURNING id',
            ['active', plan, parseInt(userId, 10)]
          );
        } else {
          await db.queryOne(
            'UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id',
            ['active', parseInt(userId, 10)]
          );
        }
        console.log(`[webhook] Utilisateur #${userId} activé (plan: ${plan || 'inchangé'})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
        const customer = await stripe.customers.retrieve(data.customer);
        const user = await findUserByEmail(customer.email);
        if (!user) {
          console.error(`[webhook] customer.subscription.deleted: utilisateur introuvable pour ${customer.email}`);
          break;
        }
        await db.queryOne(
          'UPDATE users SET subscription_status = $1, plan = $2 WHERE id = $3 RETURNING id',
          ['canceled', 'free', user.id]
        );
        console.log(`[webhook] Abonnement annulé — utilisateur #${user.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const user = await findUserByEmail(data.customer_email);
        if (!user) {
          console.error(`[webhook] invoice.payment_failed: utilisateur introuvable pour ${data.customer_email}`);
          break;
        }
        await db.queryOne(
          'UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id',
          ['past_due', user.id]
        );
        console.log(`[webhook] Paiement échoué — utilisateur #${user.id}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const user = await findUserByEmail(data.customer_email);
        if (!user) {
          console.error(`[webhook] invoice.payment_succeeded: utilisateur introuvable pour ${data.customer_email}`);
          break;
        }
        await db.queryOne(
          'UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id',
          ['active', user.id]
        );
        console.log(`[webhook] Paiement réussi — utilisateur #${user.id}`);
        break;
      }

      default:
        console.log(`[webhook] Événement ignoré: ${eventType}`);
    }
  } catch (error) {
    console.error(`[webhook] Erreur traitement ${eventType}:`, error.message);
    // On répond 200 quand même : Stripe ne doit pas retenter pour une erreur interne
  }

  // Toujours répondre 200 à Stripe pour accuser réception
  res.json({ received: true });
});

module.exports = router;

const Stripe = require('stripe');

/**
 * Crée un client Stripe
 * @param {string} email - Email du client
 * @param {string} businessName - Nom du commerce
 * @returns {Promise<Object>} Objet customer Stripe
 */
async function createCustomer(email, businessName) {
  try {
    // Validation
    if (!email || !email.trim()) {
      throw new Error('Email requis');
    }

    if (!businessName || !businessName.trim()) {
      throw new Error('Nom du commerce requis');
    }

    // Instancer Stripe DANS la fonction (pour compatibilité avec Jest)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    // Créer le client dans Stripe
    const customer = await stripe.customers.create({
      email: email.trim(),
      name: businessName.trim(),
      description: `Client LocalRank: ${businessName}`,
    });

    return customer;
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[createCustomer] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la création du client' : error.message,
      code: error.code || 'STRIPE_ERROR',
    };
  }
}

/**
 * Crée un abonnement pour un client
 * @param {string} customerId - ID du client Stripe
 * @param {string} priceId - ID du prix Stripe
 * @returns {Promise<Object>} Objet subscription Stripe
 */
async function createSubscription(customerId, priceId) {
  try {
    // Validation
    if (!customerId || !customerId.trim()) {
      throw new Error('ID du client requis');
    }

    if (!priceId || !priceId.trim()) {
      throw new Error('ID du prix requis');
    }

    // Instancer Stripe DANS la fonction
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    // Créer l'abonnement
    const subscription = await stripe.subscriptions.create({
      customer: customerId.trim(),
      items: [
        {
          price: priceId.trim(),
        },
      ],
    });

    return subscription;
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[createSubscription] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la création de l\'abonnement' : error.message,
      code: error.code || 'STRIPE_ERROR',
    };
  }
}

/**
 * Annule un abonnement
 * @param {string} subscriptionId - ID de l'abonnement
 * @returns {Promise<Object>} Objet subscription annulé
 */
async function cancelSubscription(subscriptionId) {
  try {
    // Validation
    if (!subscriptionId || !subscriptionId.trim()) {
      throw new Error('ID de l\'abonnement requis');
    }

    // Instancer Stripe DANS la fonction
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    // Annuler l'abonnement
    const subscription = await stripe.subscriptions.del(subscriptionId.trim());

    return subscription;
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[cancelSubscription] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de l\'annulation de l\'abonnement' : error.message,
      code: error.code || 'STRIPE_ERROR',
    };
  }
}

/**
 * Récupère les détails d'un abonnement
 * @param {string} subscriptionId - ID de l'abonnement
 * @returns {Promise<Object>} Objet subscription
 */
async function getSubscription(subscriptionId) {
  try {
    // Validation
    if (!subscriptionId || !subscriptionId.trim()) {
      throw new Error('ID de l\'abonnement requis');
    }

    // Instancer Stripe DANS la fonction
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

    // Récupérer l'abonnement
    const subscription = await stripe.subscriptions.retrieve(subscriptionId.trim());

    return subscription;
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[getSubscription] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la récupération de l\'abonnement' : error.message,
      code: error.code || 'STRIPE_ERROR',
    };
  }
}

/**
 * Gère un webhook Stripe
 * Vérifie la signature et traite l'événement
 * @param {string|Buffer} payload - Corps brut de la requête
 * @param {string} signature - En-tête Stripe-Signature
 * @returns {Promise<Object>} { received: true, event: eventType }
 */
async function handleWebhook(payload, signature) {
  try {
    // Validation
    if (!payload) {
      throw new Error('Payload webhook manquant');
    }

    if (!signature || !signature.trim()) {
      throw new Error('Signature webhook manquante');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET non configuré');
    }

    // Vérifier la signature du webhook
    let event;
    try {
      event = Stripe.webhooks.constructEvent(
        payload,
        signature.trim(),
        webhookSecret
      );
    } catch (signatureError) {
      console.error('[handleWebhook] Signature invalide:', signatureError.message);
      throw new Error('Signature webhook invalide');
    }

    // Événements gérés
    const eventType = event.type;
    const eventData = event.data.object;

    console.log(`[handleWebhook] Événement reçu: ${eventType}`);

    // Traiter selon le type d'événement
    switch (eventType) {
      case 'customer.subscription.created':
        console.log(`[handleWebhook] Abonnement créé: ${eventData.id}`);
        break;

      case 'customer.subscription.deleted':
        console.log(`[handleWebhook] Abonnement supprimé: ${eventData.id}`);
        break;

      case 'invoice.payment_succeeded':
        console.log(`[handleWebhook] Paiement réussi: ${eventData.id}`);
        break;

      case 'invoice.payment_failed':
        console.log(`[handleWebhook] Paiement échoué: ${eventData.id}`);
        break;

      default:
        console.log(`[handleWebhook] Événement ignoré: ${eventType}`);
    }

    return {
      received: true,
      event: eventType,
    };
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[handleWebhook] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors du traitement du webhook' : error.message,
      code: error.code || 'WEBHOOK_ERROR',
    };
  }
}

module.exports = {
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  handleWebhook,
};

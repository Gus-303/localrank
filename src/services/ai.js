const Anthropic = require('@anthropic-ai/sdk');

// Vérifier que la clé API Anthropic est configurée au démarrage
console.log('[AI] ANTHROPIC_API_KEY configured:', !!process.env.ANTHROPIC_API_KEY);

// Cache en mémoire pour les résultats identiques
const cache = new Map();

/**
 * Crée une clé de cache unique basée sur les paramètres
 */
function getCacheKey(type, ...params) {
  return `${type}:${params.join(':').toLowerCase()}`;
}

/**
 * Génère une réponse professionnelle à un avis Google
 * @param {string} reviewText - Contenu de l'avis
 * @param {string} businessName - Nom du commerce
 * @param {string} businessType - Type de commerce (coiffeur, restaurant, etc)
 * @returns {Promise<string>} Réponse générée
 */
async function generateReviewReply(reviewText, businessName, businessType) {
  try {
    // Validation
    if (!reviewText || !reviewText.trim()) {
      throw new Error('Le texte de l\'avis ne peut pas être vide');
    }

    if (!businessName || !businessName.trim()) {
      throw new Error('Le nom du commerce est requis');
    }

    if (!businessType || !businessType.trim()) {
      throw new Error('Le type de commerce est requis');
    }

    // Vérifier le cache
    const cacheKey = getCacheKey('reply', reviewText, businessName, businessType);
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    // Instancier le client Anthropic
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Appeler l'API Claude
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: `Tu es un assistant expert qui aide les commerces locaux à répondre aux avis Google de façon professionnelle, chaleureuse et personnalisée en français. 
Règles de réponse :
- Toujours en français
- Maximum 150 mots
- Remercier le client pour son avis
- Adresser les points spécifiques mentionnés
- Inviter le client à revenir
- Signer avec le nom du commerce`,
      messages: [
        {
          role: 'user',
          content: `Avis reçu sur Google : "${reviewText}"
Commerce : ${businessName} (${businessType})

Génère une réponse professionnelle courte et personnalisée.`,
        },
      ],
    });

    const reply = response.content[0].text.trim();

    // Stocker en cache
    cache.set(cacheKey, reply);

    return reply;
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[generateReviewReply] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la génération de la réponse' : error.message,
      code: error.code || 'AI_ERROR',
    };
  }
}

/**
 * Génère un post Google My Business hebdomadaire original
 * @param {string} businessName - Nom du commerce
 * @param {string} businessType - Type de commerce
 * @param {Array<string>} lastPostTopics - Sujets déjà traités (pour éviter les répétitions)
 * @returns {Promise<string>} Post généré
 */
async function generateWeeklyPost(businessName, businessType, lastPostTopics = []) {
  try {
    // Validation
    if (!businessName || !businessName.trim()) {
      throw new Error('Le nom du commerce est requis');
    }

    if (!businessType || !businessType.trim()) {
      throw new Error('Le type de commerce est requis');
    }

    // Vérifier le cache
    const cacheKey = getCacheKey('post', businessName, businessType, lastPostTopics.join(','));
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    // Instancier le client Anthropic
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Formater les sujets déjà traités
    const topicsText = lastPostTopics.length > 0
      ? `\nSujets déjà traités (à éviter) : ${lastPostTopics.join(', ')}`
      : '';

    // Appeler l'API Claude
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: `Tu es un expert en marketing local qui crée des posts Google My Business engageants en français.
Règles de création :
- Toujours en français
- Maximum 100 mots
- Engageant et pertinent pour le type de commerce
- Invite les clients à agir (visiter, appeler, etc)
- Peut inclure des emojis appropriés
- Original et varié`,
      messages: [
        {
          role: 'user',
          content: `Crée un post original pour cette semaine :
Commerce : ${businessName}
Type : ${businessType}${topicsText}

Génère un post court, engageant et qui invite les clients à agir.`,
        },
      ],
    });

    const post = response.content[0].text.trim();

    // Stocker en cache
    cache.set(cacheKey, post);

    return post;
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[generateWeeklyPost] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la génération du post' : error.message,
      code: error.code || 'AI_ERROR',
    };
  }
}

/**
 * Vide le cache en mémoire
 * Utile pour les tests
 */
function clearCache() {
  cache.clear();
}

module.exports = {
  generateReviewReply,
  generateWeeklyPost,
  clearCache,
};

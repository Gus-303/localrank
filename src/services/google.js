/**
 * Service d'intégration Google Business Profile
 * Gère la connexion à l'API Google My Business
 */

/**
 * Récupère les infos de la fiche Google Business
 * @param {string} accessToken - Token OAuth de Google
 * @param {string} accountId - ID du compte Google Business
 * @returns {Promise<Object>} Infos de la fiche (nom, adresse, téléphone, etc)
 */
async function getBusinessInfo(accessToken, accountId) {
  try {
    if (!accessToken || !accountId) {
      throw new Error('accessToken et accountId requis');
    }

    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        throw new Error('Token Google invalide ou expiré');
      }
      if (response.status === 403) {
        throw new Error('Accès refusé à ce compte Google Business');
      }
      if (response.status === 404) {
        throw new Error('Compte Google Business non trouvé');
      }
      
      throw new Error(`Erreur API Google: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[getBusinessInfo] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la récupération des infos' : error.message,
      code: error.code || 'GOOGLE_API_ERROR',
    };
  }
}

/**
 * Récupère les avis Google de la fiche
 * @param {string} accessToken - Token OAuth de Google
 * @param {string} accountId - ID du compte Google Business
 * @param {string} locationId - ID de la localisation
 * @returns {Promise<Array>} Liste des avis
 */
async function getReviews(accessToken, accountId, locationId) {
  try {
    if (!accessToken || !accountId || !locationId) {
      throw new Error('accessToken, accountId et locationId requis');
    }

    const response = await fetch(
      `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${accountId}/locations/${locationId}/reviews`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token Google invalide ou expiré');
      }
      if (response.status === 403) {
        throw new Error('Accès refusé à cet emplacement');
      }
      if (response.status === 404) {
        throw new Error('Emplacement non trouvé');
      }
      
      throw new Error(`Erreur API Google: ${response.status}`);
    }

    const data = await response.json();
    return data.reviews || [];
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[getReviews] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la récupération des avis' : error.message,
      code: error.code || 'GOOGLE_API_ERROR',
    };
  }
}

/**
 * Publie une réponse à un avis Google
 * @param {string} accessToken - Token OAuth de Google
 * @param {string} accountId - ID du compte Google Business
 * @param {string} locationId - ID de la localisation
 * @param {string} reviewId - ID de l'avis
 * @param {string} replyText - Texte de la réponse
 * @returns {Promise<Object>} Réponse créée
 */
async function postReviewReply(accessToken, accountId, locationId, reviewId, replyText) {
  try {
    if (!accessToken || !accountId || !locationId || !reviewId) {
      throw new Error('accessToken, accountId, locationId et reviewId requis');
    }

    if (!replyText || !replyText.trim()) {
      throw new Error('Le texte de la réponse ne peut pas être vide');
    }

    const response = await fetch(
      `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: replyText.trim(),
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token Google invalide ou expiré');
      }
      if (response.status === 403) {
        throw new Error('Accès refusé pour publier une réponse');
      }
      if (response.status === 404) {
        throw new Error('Avis ou emplacement non trouvé');
      }
      
      throw new Error(`Erreur API Google: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[postReviewReply] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la publication de la réponse' : error.message,
      code: error.code || 'GOOGLE_API_ERROR',
    };
  }
}

/**
 * Publie un post sur la fiche Google
 * @param {string} accessToken - Token OAuth de Google
 * @param {string} accountId - ID du compte Google Business
 * @param {string} locationId - ID de la localisation
 * @param {string} postContent - Contenu du post
 * @returns {Promise<Object>} Post créé
 */
async function createPost(accessToken, accountId, locationId, postContent) {
  try {
    if (!accessToken || !accountId || !locationId) {
      throw new Error('accessToken, accountId et locationId requis');
    }

    if (!postContent || !postContent.trim()) {
      throw new Error('Le contenu du post ne peut pas être vide');
    }

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/posts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: postContent.trim(),
          postType: 'STANDARD',
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token Google invalide ou expiré');
      }
      if (response.status === 403) {
        throw new Error('Accès refusé pour publier un post');
      }
      if (response.status === 404) {
        throw new Error('Emplacement non trouvé');
      }
      if (response.status === 500) {
        throw new Error('Erreur serveur Google');
      }
      
      throw new Error(`Erreur API Google: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const isProd = process.env.NODE_ENV === 'production';

    console.error('[createPost] Error:', error.message);

    throw {
      message: isProd ? 'Erreur lors de la création du post' : error.message,
      code: error.code || 'GOOGLE_API_ERROR',
    };
  }
}

module.exports = {
  getBusinessInfo,
  getReviews,
  postReviewReply,
  createPost,
};

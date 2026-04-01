const PDFDocument = require('pdfkit');
const { queryOne, queryAll } = require('../utils/db');

/**
 * Récupère les statistiques mensuelles d'un établissement.
 * @param {number} establishmentId
 * @param {string} month - Format "YYYY-MM"
 * @returns {Promise<{ establishment, stats, reviews }>}
 */
async function getMonthlyStats(establishmentId, month) {
  const startDate = `${month}-01`;
  const endDate = new Date(
    parseInt(month.slice(0, 4), 10),
    parseInt(month.slice(5, 7), 10), // mois suivant (0-indexé = mois courant)
    1
  ).toISOString().slice(0, 10);

  const establishment = await queryOne(
    'SELECT id, name, type FROM establishments WHERE id = $1',
    [establishmentId]
  );

  if (!establishment) {
    return null;
  }

  const stats = await queryOne(
    `SELECT
       COUNT(*) AS total_reviews,
       ROUND(AVG(rating), 1) AS avg_rating,
       COUNT(ai_response) AS ai_responses
     FROM reviews
     WHERE establishment_id = $1
       AND created_at >= $2
       AND created_at < $3`,
    [establishmentId, startDate, endDate]
  );

  const reviews = await queryAll(
    `SELECT author, rating, comment, ai_response, created_at
     FROM reviews
     WHERE establishment_id = $1
       AND created_at >= $2
       AND created_at < $3
     ORDER BY created_at DESC
     LIMIT 20`,
    [establishmentId, startDate, endDate]
  );

  return { establishment, stats, reviews };
}

/**
 * Génère un PDF mensuel pour un établissement.
 * @param {object} establishment - { name, type }
 * @param {object} stats - { total_reviews, avg_rating, ai_responses }
 * @param {Array} reviews - Liste des avis du mois
 * @param {string} month - Format "YYYY-MM"
 * @returns {Promise<Buffer>}
 */
function generateMonthlyPDF(establishment, stats, reviews, month) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const [year, monthNum] = month.split('-');
    const monthLabel = new Date(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // En-tête
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Rapport mensuel LocalRank', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(16)
      .font('Helvetica')
      .text(establishment.name, { align: 'center' });

    if (establishment.type) {
      doc.fontSize(12).fillColor('#666666').text(establishment.type, { align: 'center' });
    }

    doc
      .fontSize(12)
      .fillColor('#333333')
      .text(`Période : ${monthLabel}`, { align: 'center' });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);

    // Statistiques
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Résumé du mois');
    doc.moveDown(0.5);

    const totalReviews = parseInt(stats.total_reviews, 10) || 0;
    const avgRating = stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : 'N/A';
    const aiResponses = parseInt(stats.ai_responses, 10) || 0;

    doc.fontSize(12).font('Helvetica');
    doc.text(`• Avis reçus : ${totalReviews}`);
    doc.text(`• Note moyenne : ${avgRating} / 5`);
    doc.text(`• Réponses générées par IA : ${aiResponses}`);

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(1);

    // Liste des avis
    doc.fontSize(14).font('Helvetica-Bold').text('Derniers avis');
    doc.moveDown(0.5);

    if (reviews.length === 0) {
      doc.fontSize(12).font('Helvetica').fillColor('#666666').text('Aucun avis ce mois-ci.');
    } else {
      reviews.forEach((review, index) => {
        // Vérifier qu'il reste assez de place sur la page
        if (doc.y > 700) {
          doc.addPage();
        }

        const stars = '★'.repeat(review.rating || 0) + '☆'.repeat(5 - (review.rating || 0));
        const date = new Date(review.created_at).toLocaleDateString('fr-FR');
        const author = review.author || 'Anonyme';

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text(`${index + 1}. ${author} — ${stars} (${date})`);

        if (review.comment) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#333333')
            .text(`Avis : ${review.comment}`, { indent: 15 });
        }

        if (review.ai_response) {
          doc
            .fontSize(10)
            .font('Helvetica-Oblique')
            .fillColor('#0055aa')
            .text(`Réponse IA : ${review.ai_response}`, { indent: 15 });
        }

        doc.moveDown(0.5);
      });
    }

    // Pied de page
    doc.moveDown(1);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#999999')
      .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} par LocalRank`, { align: 'center' });

    doc.end();
  });
}

module.exports = { getMonthlyStats, generateMonthlyPDF };

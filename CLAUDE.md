# RÈGLES PERMANENTES — PROJET LOCALRANK
# Ce fichier est lu à chaque session. Ces règles s'appliquent à TOUT le code généré.

---

## 🧠 1. LOGIQUE
- Le code doit faire EXACTEMENT ce qui est demandé, rien de plus
- Gérer tous les cas limites (input vide, valeur nulle, API indisponible)
- Aucune hypothèse implicite : si quelque chose n'est pas clair, demander avant de coder

## 🔐 2. SÉCURITÉ — RÈGLES ABSOLUES
- JAMAIS de clé API dans le code source
- TOUTES les clés dans des variables d'environnement (.env)
- TOUS les inputs utilisateur doivent être validés et nettoyés avant traitement
- Authentification JWT vérifiée sur chaque route protégée
- AUCUNE donnée sensible dans les logs ou les messages d'erreur exposés au client
- Le fichier .env doit toujours être dans .gitignore

## 🧱 3. STRUCTURE
- Chaque fichier a une seule responsabilité claire
- Les fonctions font une seule chose
- Nommage explicite : getUserById() pas getU()
- Zéro duplication : si du code se répète, créer une fonction utilitaire

## 🐛 4. ROBUSTESSE
- Chaque appel API externe dans un try/catch
- Messages d'erreur clairs pour le développeur (logs) ET pour l'utilisateur (réponse API)
- Si un service externe tombe (Google API, Anthropic API), l'app ne doit pas planter

## 🧪 5. TESTS
- Tests unitaires obligatoires pour chaque nouvelle fonction
- Tester le cas normal + au moins 2 cas limites par fonction
- Les appels API externes doivent être mockés dans les tests

## 📉 6. PERFORMANCE
- Pas de boucle imbriquée inutile sur de grandes listes
- Mettre en cache les résultats d'API quand c'est possible
- Ne jamais faire un appel API dans une boucle

## 📦 7. DÉPENDANCES
- N'installer que les librairies strictement nécessaires
- Vérifier que chaque librairie est activement maintenue avant de l'ajouter
- Utiliser les versions stables (pas les beta ou RC)

## 🔍 8. VÉRIFICATION AVANT CHAQUE RÉPONSE
Avant de me donner du code, vérifier mentalement :
- [ ] Aucune clé API dans le code ?
- [ ] Tous les inputs sont validés ?
- [ ] Try/catch présents sur les appels externes ?
- [ ] Tests écrits ou prévus ?
- [ ] Le code est lisible par quelqu'un qui ne l'a pas écrit ?

## ⚠️ RÈGLE D'OR
Si une partie du code est complexe ou difficile à expliquer simplement
→ la simplifier ou la réécrire avant de me la donner
→ toujours pouvoir expliquer chaque ligne en langage simple

---

## 📁 STRUCTURE DU PROJET
```
localrank/
  src/
    api/          ← routes Express (auth, dashboard, reviews, posts)
    services/     ← logique métier (google.js, ai.js, stripe.js)
    middleware/   ← auth.js, validation.js, rateLimit.js
    models/       ← schémas base de données
    utils/        ← fonctions réutilisables
    app.js        ← point d'entrée
  frontend/
    pages/        ← dashboard, login, onboarding
    components/   ← widgets réutilisables
  tests/          ← un fichier test par service
  .env.example    ← template (jamais de vraies valeurs)
  .env            ← clés réelles (dans .gitignore)
  .gitignore
  CLAUDE.md       ← ce fichier
```

## 🔑 VARIABLES D'ENVIRONNEMENT REQUISES
Voir .env.example — ne jamais mettre de valeurs réelles ici.
```
GOOGLE_API_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
DATABASE_URL=
JWT_SECRET=
NODE_ENV=development
PORT=3000
```

## 🚫 CE QUI EST INTERDIT
- Mettre une vraie clé API dans n'importe quel fichier versionné
- Faire confiance à un input utilisateur sans le valider
- Ignorer une erreur avec un catch vide : catch(e) {}
- Commenter du code mort (supprimer plutôt)
- Installer une librairie sans vérifier sa date de dernière mise à jour

---

# SKILLS — LOCALRANK

Ces sections sont lues automatiquement par Claude Code à chaque session.
Elles remplacent les "skills" de Claude.ai et s'appliquent à toutes les tâches du projet.

---

## SKILL : FRONTEND DESIGN

Direction esthétique pour LocalRank : **luxury/refined SaaS** — sobre, précis, professionnel.
Inspiré de Linear, Stripe, Vercel. Jamais générique, jamais "IA".

### Règles absolues
- Zéro gradient, zéro box-shadow décoratif, zéro effet glow ou neon
- Zéro font générique (Inter, Roboto, Arial) — utiliser Geist, DM Sans, IBM Plex Sans
- Zéro couleur "IA" (violet saturé, bleu électrique, dégradés arc-en-ciel)
- font-weight 400 et 500 uniquement — jamais 600 ou 700
- Borders ultra-fines 0.5px partout
- border-radius : 6px pour composants, 10px pour cartes
- CSS variables pour toutes les couleurs
- Tout texte en français
- Responsive mobile obligatoire

### Palette LocalRank
```css
:root {
  --bg: #ffffff;
  --bg-secondary: #f7f7f6;
  --bg-tertiary: #f0efed;
  --border: rgba(0,0,0,0.08);
  --border-hover: rgba(0,0,0,0.15);
  --text: #1a1a1a;
  --text-secondary: #6b6b6b;
  --text-tertiary: #999;
  --accent: #1a1a1a;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
}
```

### Composants standards LocalRank

**Sidebar** : 220px fixe, bg blanc, border-right 0.5px
- Logo 28px border-radius 6px fond #1a1a1a
- Nav items : padding 7px 10px, border-radius 6px, icônes SVG 15px
- Section labels : 10px uppercase letter-spacing .06em
- Footer : indicateur plan avec barre de progression 3px

**Topbar** : 52px height, bg blanc, border-bottom 0.5px
- Titre 15px/500 à gauche
- Boutons d'action à droite : border 0.5px, padding 5px 12px

**Métriques** : grid 4 colonnes, bg #f7f7f6, padding 14px 16px
- Label : 11px uppercase letter-spacing .03em, color --text-secondary
- Valeur : 22px/500
- Delta : 11px avec couleur success/danger

**Cartes** : bg blanc, border 0.5px, border-radius 10px, padding 18px
- Header : titre 13px/500 + bouton action 12px à droite
- Séparateurs internes : border-bottom 0.5px

**Bouton primary** : bg #1a1a1a, color blanc, border-radius 6px, padding 6px 14px, 12px
**Bouton secondary** : bg transparent, border 0.5px, color --text-secondary

### Animations
- Transitions sur hover/focus uniquement : 150ms ease
- Pas d'animation au chargement sauf fade-in léger (opacity 0→1, 200ms)

### Typographie
```css
font-family: 'DM Sans', 'Geist', system-ui, sans-serif;
/* Tailles autorisées : 10, 11, 12, 13, 14, 15, 22px uniquement */
/* Poids autorisés : 400 (regular), 500 (medium) uniquement */
```

---

## SKILL : GÉNÉRATION PDF (RAPPORTS MENSUELS)

Utilisé pour améliorer src/services/pdf.js — les rapports PDF mensuels LocalRank.

### Stack recommandée
- **pdfkit** (déjà installé) pour la génération Node.js
- Ou **reportlab** (Python) si migration future

### Structure rapport PDF LocalRank
Chaque rapport mensuel doit contenir dans l'ordre :
1. Page de couverture : logo + nom établissement + période + score Google
2. Résumé exécutif : 4 métriques clés (note moyenne, nb avis, taux réponse, posts publiés)
3. Évolution note : graphique ASCII ou tableau mois par mois
4. Détail des avis : top 5 positifs + top 3 négatifs avec réponse publiée
5. Posts publiés : liste avec date + aperçu texte
6. Recommandations IA : 3 actions concrètes pour le mois suivant
7. Pied de page : "Généré par LocalRank — localrank.fr"

### Règles design PDF
```javascript
// Palette PDF (identique au web)
const colors = {
  black: '#1a1a1a',
  gray: '#6b6b6b',
  grayLight: '#f0efed',
  border: '#e5e5e5',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444'
};

// Typographie PDF avec pdfkit
doc.font('Helvetica').fontSize(11).fillColor(colors.gray);
doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.black);
```

### Pattern pdfkit pour LocalRank
```javascript
const PDFDocument = require('pdfkit');

function generateReport(data) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // En-tête page de couverture
  doc.rect(0, 0, doc.page.width, 120).fill('#1a1a1a');
  doc.fontSize(24).fillColor('#ffffff').text('LocalRank', 50, 40);
  doc.fontSize(14).text(`Rapport mensuel — ${data.month}`, 50, 70);

  // Métriques en grid 2x2
  drawMetricCard(doc, 50, 150, 'Note moyenne', data.avgRating, '/ 5');
  drawMetricCard(doc, 300, 150, 'Nouveaux avis', data.newReviews, 'ce mois');
  drawMetricCard(doc, 50, 280, 'Taux de réponse', data.responseRate + '%', '');
  drawMetricCard(doc, 300, 280, 'Posts publiés', data.posts, '');

  doc.end();
  return doc;
}

function drawMetricCard(doc, x, y, label, value, unit) {
  doc.rect(x, y, 220, 100).fill('#f7f7f6');
  doc.fontSize(10).fillColor('#6b6b6b').text(label.toUpperCase(), x + 16, y + 16);
  doc.fontSize(32).fillColor('#1a1a1a').text(String(value), x + 16, y + 36);
  if (unit) doc.fontSize(12).fillColor('#999').text(unit, x + 16, y + 74);
}
```

### Bonnes pratiques PDF
- Toujours `doc.end()` dans un try/finally
- Streamer le PDF vers la réponse HTTP : `doc.pipe(res)`
- Nommer les fichiers : `rapport-[etablissement]-[YYYY-MM].pdf`
- Ajouter les métadonnées : `doc.info.Title`, `doc.info.Author = 'LocalRank'`
- Gérer les sauts de page automatiquement avec `doc.addPage()`

---

## SKILL : SÉCURITÉ & VALIDATION

Appliqué à toutes les routes Express de LocalRank.

### Validation des inputs (middleware)
```javascript
// Toujours valider avant traitement
const { body, validationResult } = require('express-validator');

const validateEstablishment = [
  body('name').trim().isLength({ min: 2, max: 100 }).escape(),
  body('address').trim().isLength({ min: 5, max: 200 }),
  body('google_place_id').optional().trim().isAlphanumeric(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

### Règles absolues sécurité
- JWT vérifié sur CHAQUE route protégée via middleware auth.js
- Jamais de données sensibles dans les logs (tokens, passwords, clés API)
- Toujours vérifier ownership avant DELETE/UPDATE (req.user.id === resource.user_id)
- Rate limiting sur les routes publiques (auth, webhook)
- Sanitiser tous les inputs avant insertion PostgreSQL (paramètres préparés uniquement)
- Headers de sécurité : helmet.js activé

### Pattern ownership check
```javascript
// Toujours vérifier que la ressource appartient à l'utilisateur
const establishment = await db.query(
  'SELECT * FROM establishments WHERE id = $1 AND user_id = $2',
  [req.params.id, req.user.id]
);
if (!establishment.rows[0]) {
  return res.status(403).json({ error: 'Accès interdit' });
}
```

---

## SKILL : STRIPE & ABONNEMENTS

Appliqué à src/api/payments.js et src/services/stripe.js.

### Plans LocalRank
```javascript
const PLANS = {
  free:    { name: 'Gratuit',  establishments: 0,  price: 0 },
  starter: { name: 'Starter', establishments: 1,  price: 29 },
  pro:     { name: 'Pro',     establishments: 3,  price: 79 },
  agency:  { name: 'Agency',  establishments: 10, price: 199 }
};
```

### Webhook Stripe — events à gérer
```javascript
switch (event.type) {
  case 'checkout.session.completed':
    // Activer l'abonnement + mettre à jour le plan
    break;
  case 'customer.subscription.updated':
    // Upgrade/downgrade — mettre à jour le plan
    break;
  case 'customer.subscription.deleted':
    // Annulation — repasser en free
    break;
  case 'invoice.payment_failed':
    // Paiement échoué — notifier l'utilisateur
    break;
}
```

### Règle dotenv Railway (CRITIQUE)
```javascript
// TOUJOURS utiliser override: false pour ne pas écraser les vars Railway
require('dotenv').config({ override: false });
// Jamais : require('dotenv').config() seul
```

---

## SKILL : BASE DE DONNÉES POSTGRESQL

Appliqué à toutes les queries de LocalRank.

### Patterns de base
```javascript
// Toujours utiliser des paramètres préparés
const result = await db.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Transactions pour les opérations multiples
const client = await db.getClient();
try {
  await client.query('BEGIN');
  await client.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);
  await client.query('INSERT INTO events (...) VALUES (...)', [...]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### Tables LocalRank (schéma actuel)
- `users` : id, email, password_hash, plan, subscription_status, google_access_token, google_refresh_token, stripe_customer_id, created_at
- `establishments` : id, user_id, name, address, google_place_id, created_at
- `reviews` : id, establishment_id, google_review_id, author, rating, text, response_text, responded_at, created_at
- `posts` : id, establishment_id, content, published_at, status (draft/scheduled/published), created_at

### Règle critique DATABASE_URL
- Ne jamais laisser le .env local écraser DATABASE_URL en production
- Toujours `require('dotenv').config({ override: false })`
- Vérifier Railway dashboard que DATABASE_URL pointe vers la bonne DB

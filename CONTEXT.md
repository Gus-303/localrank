# CONTEXT — PROJET LOCALRANK

## 1. DESCRIPTION
LocalRank est un SaaS qui aide les commerces locaux
(coiffeurs, restaurants, garages) à améliorer leur
visibilité sur Google Maps en automatisant :
- Les réponses aux avis Google (générées par IA)
- La publication de posts Google hebdomadaires
- Le suivi du score de leur fiche Google My Business
- Les rapports mensuels PDF automatiques

## 2. STACK TECHNIQUE
- Backend : Node.js + Express
- Base de données : PostgreSQL
- Auth : JWT + bcrypt
- Paiements : Stripe (abonnements récurrents)
- IA : API Anthropic Claude (via @anthropic-ai/sdk)
- API externe : Google Business Profile API

## 3. STRUCTURE DES FICHIERS
localrank/
  src/
    api/         ← routes Express
      cron.js    ← routes déclenchement manuel cron
      reports.js ← routes génération rapports PDF
    services/    ← google.js, ai.js, stripe.js
      cron.js    ← logique posts automatiques hebdomadaires (lundi 9h)
      pdf.js     ← génération rapports PDF mensuels
    middleware/  ← auth.js, validation.js
    models/      ← schémas base de données
    utils/       ← fonctions réutilisables
    app.js       ← point d'entrée
  frontend/
    pages/
    components/
  tests/
  .env.example
  .gitignore
  CLAUDE.md
  CONTEXT.md
  PROMPTS.md
  package.json

## 4. RÈGLES ABSOLUES
- Lire CLAUDE.md avant chaque session
- Lire CONTEXT.md pour comprendre le projet
- Ne jamais inventer une fonction qui existe déjà
- Toujours vérifier la cohérence avec le code existant
- Mettre à jour la section ÉTAT ACTUEL après chaque phase

## 5. ÉTAT ACTUEL
- [x] Structure de base créée
- [x] Authentification (src/api/auth.js)
- [x] Connexion Google Business Profile API (src/api/google-auth.js)
  - [x] GET /api/google/auth - Génère l'URL d'autorisation Google OAuth (protégée)
  - [x] GET /api/google/callback - Échange le code contre un access_token
  - [x] GET /api/google/reviews - Récupère les avis (protégée)
  - [x] Colonnes google_access_token et google_refresh_token ajoutées
- [x] Génération IA des réponses et posts
- [x] Paiements Stripe (src/api/payments.js)
  - [x] GET /api/payments/prices - retourne les priceIds depuis les variables d'environnement (public)
  - [x] POST /api/payments/create-checkout - crée une session Stripe Checkout (protégée)
  - [x] GET /api/payments/success - met à jour subscription_status = 'active' ET plan (protégée)
    - Query param optionnel priceId pour déduire le plan (starter/pro)
- [x] Dashboard frontend
- [x] PostgreSQL intégré
- [x] Configuration Railway (Procfile + railway.json)
- [x] Routes API de test Anthropic (src/api/ai.js)
- [x] Système multi-établissements avec limites par plan
  - [x] Table establishments (src/utils/migrations.js)
  - [x] Colonne plan dans users (src/utils/migrations.js)
  - [x] Limites par plan (src/utils/planLimits.js) : free=0, starter=1, pro=3
  - [x] GET /api/establishments - liste les établissements (protégée)
  - [x] POST /api/establishments - crée un établissement (vérifie limite plan, protégée)
  - [x] DELETE /api/establishments/:id - supprime (vérifie ownership, protégée)
  - [x] Section "Mes établissements" dans le dashboard frontend

## 8. FONCTIONNALITÉS OPÉRATIONNELLES
- ✅ Authentification JWT + bcrypt
- ✅ Google Business Profile API connectée
- ✅ Génération IA des réponses et posts
- ✅ Paiements Stripe (Starter 29€, Pro 69€)
- ✅ Webhook Stripe
- ✅ Alertes email avis négatifs
- ✅ Score de réputation 0-100
- ✅ Analyse thématique IA
- ✅ QR Code, Widget, Page publique
- ✅ Campagnes demande d'avis

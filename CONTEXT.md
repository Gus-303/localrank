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
    services/    ← google.js, ai.js, stripe.js
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
- [x] Connexion Google Business Profile API
- [x] Génération IA des réponses et posts
- [x] Paiements Stripe
- [ ] Dashboard frontend

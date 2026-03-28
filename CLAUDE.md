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

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { isValidEmail, isValidPassword } = require('../utils/validation');

const router = express.Router();

/**
 * POST /api/auth/register
 * Créer un nouveau compte utilisateur
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, businessName } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email requis.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email invalide.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au minimum 8 caractères.' });
    }

    if (!businessName || !businessName.trim()) {
      return res.status(400).json({ error: 'Nom du commerce requis.' });
    }

    const newUser = await User.create(email.trim(), password, businessName.trim());

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès.',
      token,
      user: newUser.toJSON(),
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    console.error('[POST /register] Error:', error.message);

    if (error.status === 400) {
      return res.status(409).json({ error: 'Cet email est déjà enregistré.' });
    }

    res.status(500).json({
      error: isDev ? error.message : 'Erreur lors de la création du compte.',
    });
  }
});

/**
 * POST /api/auth/login
 * Se connecter avec email et password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email requis.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis.' });
    }

    const user = await User.findByEmail(email.trim());

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const isValid = await user.comparePassword(password);

    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion réussie.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    console.error('[POST /login] Error:', error.message);

    res.status(500).json({
      error: isDev ? error.message : 'Erreur lors de la connexion.',
    });
  }
});

/**
 * GET /api/auth/me
 * Récupérer les infos de l'utilisateur connecté
 * Route protégée par JWT
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    console.error('[GET /me] Error:', error.message);

    res.status(500).json({
      error: isDev ? error.message : 'Erreur serveur.',
    });
  }
});

module.exports = router;

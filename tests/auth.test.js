require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const authRouter = require('../src/api/auth');
const db = require('../src/utils/database');

// Setup app pour les tests
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// Avant chaque test, nettoyer la BD en mémoire
beforeEach(() => {
  db.clearUsers();
});

describe('Authentication', () => {
  // =====================
  // Tests de REGISTER
  // =====================

  test('register: email valide avec password valide', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: 'SecurePass123',
        businessName: 'Mon Salon',
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe('user@example.com');
    expect(response.body.user.password).toBeUndefined();
  });

  test('register: email invalide', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'SecurePass123',
        businessName: 'Mon Salon',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('Format email invalide');
  });

  test('register: password trop court', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: 'Short1',
        businessName: 'Mon Salon',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('minimum 8 caractères');
  });

  test('register: email déjà utilisé', async () => {
    // Créer le premier utilisateur
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'SecurePass123',
        businessName: 'Commerce 1',
      });

    // Essayer avec le même email
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'AnotherPass123',
        businessName: 'Commerce 2',
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toContain('déjà enregistré');
  });

  test('register: email manquant', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        password: 'SecurePass123',
        businessName: 'Mon Salon',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('Email requis');
  });

  // =====================
  // Tests de LOGIN
  // =====================

  test('login: credentials corrects', async () => {
    // Créer un utilisateur
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'login@example.com',
        password: 'CorrectPass123',
        businessName: 'Mon Salon',
      });

    // Login
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'CorrectPass123',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe('login@example.com');
  });

  test('login: mot de passe incorrect', async () => {
    // Créer un utilisateur
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'login@example.com',
        password: 'CorrectPass123',
        businessName: 'Mon Salon',
      });

    // Login avec mauvais password
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'WrongPassword',
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toContain('Email ou mot de passe incorrect');
  });

  test('login: email inexistant', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'AnyPassword123',
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toContain('Email ou mot de passe incorrect');
  });

  test('login: email manquant', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        password: 'AnyPassword123',
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('Email requis');
  });

  // =====================
  // Tests de GET /me
  // =====================

  test('GET /me: sans token', async () => {
    const response = await request(app)
      .get('/api/auth/me');

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toContain('manquant');
  });

  test('GET /me: avec token invalide', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toContain('invalide');
  });

  test('GET /me: avec token valide', async () => {
    // Créer un utilisateur et récupérer son token
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'me@example.com',
        password: 'ValidPass123',
        businessName: 'Mon Salon',
      });

    const token = registerRes.body.token;

    // Récupérer ses infos
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.user.email).toBe('me@example.com');
    expect(response.body.user.password).toBeUndefined();
  });

  test('GET /me: token expiré', async () => {
    // Créer un token expiré
    const expiredToken = jwt.sign(
      { id: 999, email: 'test@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' } // Négatif = déjà expiré
    );

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toContain('expiré');
  });
});

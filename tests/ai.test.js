jest.mock('@anthropic-ai/sdk');

const mockCreate = jest.fn();
require('@anthropic-ai/sdk').mockImplementation(() => ({
  messages: { create: mockCreate }
}));

const aiService = require('../src/services/ai');

beforeEach(() => {
  mockCreate.mockClear();
  aiService.clearCache();
});

describe('AI Service', () => {
  // =====================
  // Tests generateReviewReply
  // =====================

  test('generateReviewReply: avis positif', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Merci beaucoup pour votre excellent avis ! Nous sommes ravis que vous ayez apprécié notre service.',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const result = await aiService.generateReviewReply(
      'Excellent service, très professionnel!',
      'Salon de Coiffure Jean',
      'Coiffeur'
    );

    expect(result).toContain('Merci');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Avis reçu'),
          }),
        ]),
      })
    );
  });

  test('generateReviewReply: avis négatif', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Nous sommes désolés que votre expérience n\'ait pas été à la hauteur. Nous vous invitons à nous contacter pour résoudre cette situation.',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const result = await aiService.generateReviewReply(
      'Mauvaise qualité de service',
      'Salon de Coiffure Jean',
      'Coiffeur'
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  test('generateReviewReply: reviewText vide', async () => {
    await expect(
      aiService.generateReviewReply('', 'Salon Jean', 'Coiffeur')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ne peut pas être vide'),
    });
  });

  test('generateReviewReply: businessName vide', async () => {
    await expect(
      aiService.generateReviewReply('Bon service', '', 'Coiffeur')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });

  test('generateReviewReply: businessType vide', async () => {
    await expect(
      aiService.generateReviewReply('Bon service', 'Salon Jean', '')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });

  test('generateReviewReply: erreur API Anthropic', async () => {
    mockCreate.mockRejectedValueOnce(
      new Error('API Anthropic indisponible')
    );

    await expect(
      aiService.generateReviewReply(
        'Bon service',
        'Salon Jean',
        'Coiffeur'
      )
    ).rejects.toMatchObject({
      code: 'AI_ERROR',
    });
  });

  test('generateReviewReply: cache fonctionne', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Réponse en cache',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    // Premier appel
    await aiService.generateReviewReply('Avis', 'Salon', 'Coiffeur');

    // Réinitialiser le mock
    mockCreate.mockClear();

    // Deuxième appel identique (doit revenir du cache)
    const result = await aiService.generateReviewReply('Avis', 'Salon', 'Coiffeur');

    expect(result).toBe('Réponse en cache');
    // create() ne doit pas être appelé (résultat du cache)
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // =====================
  // Tests generateWeeklyPost
  // =====================

  test('generateWeeklyPost: succès sans sujets précédents', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: '📢 Rejoignez-nous cette semaine pour une expérience inoubliable!',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const result = await aiService.generateWeeklyPost(
      'Salon de Coiffure Jean',
      'Coiffeur'
    );

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
      })
    );
  });

  test('generateWeeklyPost: avec sujets déjà traités', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Découvrez nos nouveaux services cette semaine!',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    const result = await aiService.generateWeeklyPost(
      'Salon Jean',
      'Coiffeur',
      ['promotion', 'nouveauté']
    );

    expect(result).toBeDefined();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('promotion'),
          }),
        ]),
      })
    );
  });

  test('generateWeeklyPost: businessName vide', async () => {
    await expect(
      aiService.generateWeeklyPost('', 'Coiffeur')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });

  test('generateWeeklyPost: businessType vide', async () => {
    await expect(
      aiService.generateWeeklyPost('Salon Jean', '')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });

  test('generateWeeklyPost: erreur API Anthropic', async () => {
    mockCreate.mockRejectedValueOnce(
      new Error('Erreur de quota API')
    );

    await expect(
      aiService.generateWeeklyPost('Salon Jean', 'Coiffeur')
    ).rejects.toMatchObject({
      code: 'AI_ERROR',
    });
  });

  test('generateWeeklyPost: cache fonctionne', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Post en cache',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    // Premier appel
    await aiService.generateWeeklyPost('Salon', 'Coiffeur');

    // Réinitialiser le mock
    mockCreate.mockClear();

    // Deuxième appel identique (doit revenir du cache)
    const result = await aiService.generateWeeklyPost('Salon', 'Coiffeur');

    expect(result).toBe('Post en cache');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('clearCache: vide bien le cache', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Réponse 1',
        },
      ],
    };

    mockCreate.mockResolvedValueOnce(mockResponse);

    // Premier appel (mise en cache)
    await aiService.generateReviewReply('Avis', 'Salon', 'Coiffeur');

    // Vider le cache
    aiService.clearCache();

    // Configurer un nouveau mock avec une réponse différente
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Réponse 2 (pas en cache)',
        },
      ],
    });

    // Deuxième appel identique (doit faire un nouvel appel API)
    const result = await aiService.generateReviewReply('Avis', 'Salon', 'Coiffeur');

    expect(result).toBe('Réponse 2 (pas en cache)');
    expect(mockCreate).toHaveBeenCalled();
  });
});

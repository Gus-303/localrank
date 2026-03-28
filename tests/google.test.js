const googleService = require('../src/services/google');

// Mock global fetch
global.fetch = jest.fn();

describe('Google Business Profile Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // =====================
  // Tests getBusinessInfo
  // =====================

  test('getBusinessInfo: succès avec token valide', async () => {
    const mockResponse = {
      name: 'accounts/123/businesses/456',
      displayName: 'Mon Salon',
      phoneNumber: '+33612345678',
      websiteUri: 'https://monsalon.fr',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await googleService.getBusinessInfo('token123', 'account123');

    expect(result.displayName).toBe('Mon Salon');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('accounts/account123'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer token123',
        }),
      })
    );
  });

  test('getBusinessInfo: token invalide (401)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.getBusinessInfo('invalidToken', 'account123')
    ).rejects.toMatchObject({
      message: expect.stringContaining('invalide ou expiré'),
    });
  });

  test('getBusinessInfo: accès refusé (403)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.getBusinessInfo('token123', 'account123')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Accès refusé'),
    });
  });

  test('getBusinessInfo: compte non trouvé (404)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.getBusinessInfo('token123', 'invalidAccount')
    ).rejects.toMatchObject({
      message: expect.stringContaining('non trouvé'),
    });
  });

  test('getBusinessInfo: paramètres manquants', async () => {
    await expect(
      googleService.getBusinessInfo('', 'account123')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });

  // =====================
  // Tests getReviews
  // =====================

  test('getReviews: succès', async () => {
    const mockReviews = [
      {
        reviewId: 'review1',
        reviewer: { displayName: 'John' },
        reviewRating: 5,
        reviewText: 'Excellent!',
        createTime: '2024-01-15',
      },
      {
        reviewId: 'review2',
        reviewer: { displayName: 'Jane' },
        reviewRating: 4,
        reviewText: 'Très bien',
        createTime: '2024-01-14',
      },
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ reviews: mockReviews }),
    });

    const result = await googleService.getReviews(
      'token123',
      'account123',
      'location456'
    );

    expect(result).toHaveLength(2);
    expect(result[0].reviewRating).toBe(5);
  });

  test('getReviews: aucun avis trouvé', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    const result = await googleService.getReviews(
      'token123',
      'account123',
      'location456'
    );

    expect(result).toEqual([]);
  });

  test('getReviews: accès refusé (403)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.getReviews('token123', 'account123', 'location456')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Accès refusé'),
    });
  });

  test('getReviews: paramètres manquants', async () => {
    await expect(
      googleService.getReviews('token123', '', 'location456')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });

  // =====================
  // Tests postReviewReply
  // =====================

  test('postReviewReply: succès', async () => {
    const mockReply = {
      comment: 'Merci pour votre avis!',
      createTime: '2024-01-16',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockReply),
    });

    const result = await googleService.postReviewReply(
      'token123',
      'account123',
      'location456',
      'review1',
      'Merci pour votre avis!'
    );

    expect(result.comment).toBe('Merci pour votre avis!');
  });

  test('postReviewReply: texte vide', async () => {
    await expect(
      googleService.postReviewReply(
        'token123',
        'account123',
        'location456',
        'review1',
        ''
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('ne peut pas être vide'),
    });
  });

  test('postReviewReply: accès refusé (403)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.postReviewReply(
        'token123',
        'account123',
        'location456',
        'review1',
        'Réponse'
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('refusé'),
    });
  });

  test('postReviewReply: avis non trouvé (404)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.postReviewReply(
        'token123',
        'account123',
        'location456',
        'invalidReview',
        'Réponse'
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('non trouvé'),
    });
  });

  // =====================
  // Tests createPost
  // =====================

  test('createPost: succès', async () => {
    const mockPost = {
      name: 'accounts/123/locations/456/posts/789',
      summary: 'Nouvelle promotion!',
      postType: 'STANDARD',
      createTime: '2024-01-16',
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockPost),
    });

    const result = await googleService.createPost(
      'token123',
      'account123',
      'location456',
      'Nouvelle promotion!'
    );

    expect(result.summary).toBe('Nouvelle promotion!');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('locations/location456/posts'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  test('createPost: contenu vide', async () => {
    await expect(
      googleService.createPost('token123', 'account123', 'location456', '')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ne peut pas être vide'),
    });
  });

  test('createPost: contenu avec espaces seulement', async () => {
    await expect(
      googleService.createPost('token123', 'account123', 'location456', '   ')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ne peut pas être vide'),
    });
  });

  test('createPost: accès refusé (403)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.createPost(
        'token123',
        'account123',
        'location456',
        'Post'
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('refusé'),
    });
  });

  test('createPost: erreur serveur Google (500)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({}),
    });

    await expect(
      googleService.createPost(
        'token123',
        'account123',
        'location456',
        'Post'
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('serveur Google'),
    });
  });

  test('createPost: paramètres manquants', async () => {
    await expect(
      googleService.createPost('token123', '', 'location456', 'Post')
    ).rejects.toMatchObject({
      message: expect.stringContaining('requis'),
    });
  });
});

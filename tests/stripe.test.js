jest.mock('stripe');

const Stripe = require('stripe');
const stripeService = require('../src/services/stripe');

const mockCustomersCreate = jest.fn();
const mockSubscriptionsCreate = jest.fn();
const mockSubscriptionsDel = jest.fn();
const mockSubscriptionsRetrieve = jest.fn();
const mockConstructEvent = jest.fn();

// Mock le constructeur de Stripe
Stripe.mockImplementation(() => ({
  customers: { create: mockCustomersCreate },
  subscriptions: {
    create: mockSubscriptionsCreate,
    del: mockSubscriptionsDel,
    retrieve: mockSubscriptionsRetrieve,
  },
}));

// Mock Stripe.webhooks.constructEvent avec validation de signature
Stripe.webhooks = { constructEvent: mockConstructEvent };

beforeEach(() => {
  mockCustomersCreate.mockClear();
  mockSubscriptionsCreate.mockClear();
  mockSubscriptionsDel.mockClear();
  mockSubscriptionsRetrieve.mockClear();
  mockConstructEvent.mockClear();

  // Implémentation par défaut du mock qui valide STRIPE_WEBHOOK_SECRET
  mockConstructEvent.mockImplementation((payload, signature, secret) => {
    // Vérifier que la clé secrète est correcte
    if (secret !== process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Invalid webhook secret');
    }

    // Si la signature est invalide, lever une erreur
    if (signature === 'invalid_signature') {
      throw new Error('No matching signing secret found for the given signature');
    }

    // Retourner un événement générique (peut être overridé par les tests)
    return {
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_default' } },
    };
  });
});

describe('Stripe Service', () => {
  // =====================
  // Tests createCustomer
  // =====================

  test('createCustomer: succès', async () => {
    const mockCustomer = {
      id: 'cus_123456',
      email: 'test@example.com',
      name: 'Mon Salon',
      description: 'Client LocalRank: Mon Salon',
    };

    mockCustomersCreate.mockResolvedValueOnce(mockCustomer);

    const result = await stripeService.createCustomer(
      'test@example.com',
      'Mon Salon'
    );

    expect(result).toEqual(mockCustomer);
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        name: 'Mon Salon',
        description: expect.stringContaining('Mon Salon'),
      })
    );
  });

  test('createCustomer: email vide', async () => {
    await expect(
      stripeService.createCustomer('', 'Mon Salon')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Email requis'),
    });
  });

  test('createCustomer: businessName vide', async () => {
    await expect(
      stripeService.createCustomer('test@example.com', '')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Nom du commerce requis'),
    });
  });

  test('createCustomer: erreur API Stripe', async () => {
    mockCustomersCreate.mockRejectedValueOnce(
      new Error('Stripe API error')
    );

    await expect(
      stripeService.createCustomer('test@example.com', 'Mon Salon')
    ).rejects.toMatchObject({
      code: 'STRIPE_ERROR',
    });
  });

  // =====================
  // Tests createSubscription
  // =====================

  test('createSubscription: succès', async () => {
    const mockSubscription = {
      id: 'sub_123456',
      customer: 'cus_123456',
      items: {
        data: [
          {
            price: {
              id: 'price_123456',
            },
          },
        ],
      },
      status: 'active',
    };

    mockSubscriptionsCreate.mockResolvedValueOnce(mockSubscription);

    const result = await stripeService.createSubscription(
      'cus_123456',
      'price_123456'
    );

    expect(result).toEqual(mockSubscription);
    expect(mockSubscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_123456',
        items: [
          {
            price: 'price_123456',
          },
        ],
      })
    );
  });

  test('createSubscription: customerId vide', async () => {
    await expect(
      stripeService.createSubscription('', 'price_123456')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ID du client requis'),
    });
  });

  test('createSubscription: priceId vide', async () => {
    await expect(
      stripeService.createSubscription('cus_123456', '')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ID du prix requis'),
    });
  });

  test('createSubscription: erreur API Stripe', async () => {
    mockSubscriptionsCreate.mockRejectedValueOnce(
      new Error('Customer not found')
    );

    await expect(
      stripeService.createSubscription('cus_invalid', 'price_123456')
    ).rejects.toMatchObject({
      code: 'STRIPE_ERROR',
    });
  });

  // =====================
  // Tests cancelSubscription
  // =====================

  test('cancelSubscription: succès', async () => {
    const mockCancelledSubscription = {
      id: 'sub_123456',
      status: 'canceled',
      canceled_at: 1234567890,
    };

    mockSubscriptionsDel.mockResolvedValueOnce(mockCancelledSubscription);

    const result = await stripeService.cancelSubscription('sub_123456');

    expect(result).toEqual(mockCancelledSubscription);
    expect(mockSubscriptionsDel).toHaveBeenCalledWith('sub_123456');
  });

  test('cancelSubscription: subscriptionId vide', async () => {
    await expect(
      stripeService.cancelSubscription('')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ID de l\'abonnement requis'),
    });
  });

  test('cancelSubscription: erreur API Stripe', async () => {
    mockSubscriptionsDel.mockRejectedValueOnce(
      new Error('Subscription not found')
    );

    await expect(
      stripeService.cancelSubscription('sub_invalid')
    ).rejects.toMatchObject({
      code: 'STRIPE_ERROR',
    });
  });

  // =====================
  // Tests getSubscription
  // =====================

  test('getSubscription: succès', async () => {
    const mockSubscription = {
      id: 'sub_123456',
      customer: 'cus_123456',
      status: 'active',
      current_period_start: 1234567890,
      current_period_end: 1234567890,
    };

    mockSubscriptionsRetrieve.mockResolvedValueOnce(mockSubscription);

    const result = await stripeService.getSubscription('sub_123456');

    expect(result).toEqual(mockSubscription);
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123456');
  });

  test('getSubscription: subscriptionId vide', async () => {
    await expect(
      stripeService.getSubscription('')
    ).rejects.toMatchObject({
      message: expect.stringContaining('ID de l\'abonnement requis'),
    });
  });

  test('getSubscription: erreur API Stripe', async () => {
    mockSubscriptionsRetrieve.mockRejectedValueOnce(
      new Error('Subscription not found')
    );

    await expect(
      stripeService.getSubscription('sub_invalid')
    ).rejects.toMatchObject({
      code: 'STRIPE_ERROR',
    });
  });

  // =====================
  // Tests handleWebhook
  // =====================

  test('handleWebhook: signature valide (subscription.created)', async () => {
    const mockPayload = Buffer.from('test_payload');
    const mockSignature = 'valid_signature';
    const mockEvent = {
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123456',
        },
      },
    };

    mockConstructEvent.mockReturnValueOnce(mockEvent);

    const result = await stripeService.handleWebhook(
      mockPayload,
      mockSignature
    );

    expect(result).toEqual({
      received: true,
      event: 'customer.subscription.created',
    });
    expect(mockConstructEvent).toHaveBeenCalledWith(
      mockPayload,
      mockSignature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  });

  test('handleWebhook: signature valide (subscription.deleted)', async () => {
    const mockPayload = Buffer.from('test_payload');
    const mockSignature = 'valid_signature';
    const mockEvent = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_123456',
        },
      },
    };

    mockConstructEvent.mockReturnValueOnce(mockEvent);

    const result = await stripeService.handleWebhook(
      mockPayload,
      mockSignature
    );

    expect(result).toEqual({
      received: true,
      event: 'customer.subscription.deleted',
    });
  });

  test('handleWebhook: signature valide (invoice.payment_succeeded)', async () => {
    const mockPayload = Buffer.from('test_payload');
    const mockSignature = 'valid_signature';
    const mockEvent = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_123456',
        },
      },
    };

    mockConstructEvent.mockReturnValueOnce(mockEvent);

    const result = await stripeService.handleWebhook(
      mockPayload,
      mockSignature
    );

    expect(result).toEqual({
      received: true,
      event: 'invoice.payment_succeeded',
    });
  });

  test('handleWebhook: signature valide (invoice.payment_failed)', async () => {
    const mockPayload = Buffer.from('test_payload');
    const mockSignature = 'valid_signature';
    const mockEvent = {
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_123456',
        },
      },
    };

    mockConstructEvent.mockReturnValueOnce(mockEvent);

    const result = await stripeService.handleWebhook(
      mockPayload,
      mockSignature
    );

    expect(result).toEqual({
      received: true,
      event: 'invoice.payment_failed',
    });
  });

  test('handleWebhook: signature invalide', async () => {
    const mockPayload = Buffer.from('test_payload');
    const mockSignature = 'invalid_signature';

    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('No matching signing secret found for the given signature');
    });

    await expect(
      stripeService.handleWebhook(mockPayload, mockSignature)
    ).rejects.toMatchObject({
      message: expect.stringContaining('Signature webhook invalide'),
    });
  });

  test('handleWebhook: payload manquant', async () => {
    await expect(
      stripeService.handleWebhook(null, 'valid_signature')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Payload webhook manquant'),
    });
  });

  test('handleWebhook: signature manquante', async () => {
    const mockPayload = Buffer.from('test_payload');

    await expect(
      stripeService.handleWebhook(mockPayload, '')
    ).rejects.toMatchObject({
      message: expect.stringContaining('Signature webhook manquante'),
    });
  });
});

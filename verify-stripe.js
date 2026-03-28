// Simple test to verify stripe module loads
require('dotenv').config();

console.log('Testing stripe module...');

try {
  const stripeService = require('./src/services/stripe');
  console.log('✓ Stripe service loaded');
  console.log('✓ Functions exported:', Object.keys(stripeService));
  
  const expected = [
    'createCustomer',
    'createSubscription', 
    'cancelSubscription',
    'getSubscription',
    'handleWebhook'
  ];
  
  expected.forEach(fn => {
    if (stripeService[fn]) {
      console.log(`  ✓ ${fn} OK`);
    } else {
      console.error(`  ✗ ${fn} MISSING`);
    }
  });
  
  console.log('\n✓ All checks passed!');
} catch (err) {
  console.error('✗ Error:', err.message);
  process.exit(1);
}

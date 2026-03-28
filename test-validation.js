// Simple validation script to check if the AI service loads without errors

require('dotenv').config();

// Mock the Anthropic SDK before requiring aiService
jest.mock('@anthropic-ai/sdk');

const mockCreate = jest.fn();
require('@anthropic-ai/sdk').mockImplementation(() => ({
  messages: { create: mockCreate }
}));

const aiService = require('../src/services/ai');

console.log('✓ aiService loaded successfully');
console.log('✓ hasOwnProperty(generateReviewReply):', aiService.hasOwnProperty('generateReviewReply'));
console.log('✓ hasOwnProperty(generateWeeklyPost):', aiService.hasOwnProperty('generateWeeklyPost'));
console.log('✓ hasOwnProperty(clearCache):', aiService.hasOwnProperty('clearCache'));
